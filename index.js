import cors from "cors"
import express from "express"
import bodyParser from "body-parser"
import {MongoClient,ObjectId} from "mongodb"
import path from "path"
import fileupload from "express-fileupload"
import { uploadFile } from "@uploadcare/upload-client"
import {deleteFile,UploadcareSimpleAuthSchema} from '@uploadcare/rest-client';
import nodemailer from "nodemailer"
import axios from "axios"
import * as cheerio from "cheerio";
import fs from 'fs'
import stringSimilarity from "string-similarity";


const PORT = process.env.PORT|| 3001;
const app=express()
app.use(cors())
app.use(fileupload());
app.use(bodyParser.urlencoded({extended:true}))
app.listen(PORT,()=>{
    console.log("run");
})

const client=new MongoClient("mongodb://apo:jac2001min@cluster0-shard-00-00.pdunp.mongodb.net:27017,cluster0-shard-00-01.pdunp.mongodb.net:27017,cluster0-shard-00-02.pdunp.mongodb.net:27017/?ssl=true&replicaSet=atlas-me2tz8-shard-0&authSource=admin&retryWrites=true&w=majority")

//registrati
app.put("/signup", async (req,res)=>{
    let info=req.body
    let countError=0
    let error="you have not filled in the field: "
    if(info.email===""){
        countError++
        error=error+"email, "
    }
    if(info.password===""){
        countError++
        error=error+"password, "
    }
    if(info.nome===""){
        countError++
        error=error+"name, "
    }
    if(info.eta===""){
        countError++
        error=error+"age, "
    }
    if(info.sesso===""){
        countError++
        error=error+"gender, "
    }
    if(info.sport_preferito===""){
        countError++
        error=error+"favourite sport, "
    }
    if(countError>0){
        res.status(500).send(error)
    }
    else{
        client.db("palestra").collection("users").findOne({password:info.password,email:info.email}).then(e=>{
            if(!e){
                info["_id"]=new ObjectId()
                info.peso=60
                info.altezza=1.75
                client.db("palestra").collection("users").insertOne(info).then((e)=>{
                    res.status(200).send(JSON.stringify(info["_id"]))
                })
            }else{
                res.status(500).send("Already existing user")
            }
        })
    }
})
//accedi
app.put("/login", async (req,res)=>{
    let info=req.body
    let countError=0
    let error="you have not filled in the field: "
    if(info.email===""){
        countError++
        error=error+"email, "
    }
    if(info.password===""){
        countError++
        error=error+"password, "
    }
    if(countError>0){
        res.status(500).send(error)
    }else{
        client.db("palestra").collection("users").findOne({password:info.password,email:info.email}).then(e=>{
            if(!e){
                res.status(500).send("User does not exist, Register!")
            }else{
                res.status(200).send(e._id)
            }
        })
    }
})
//cerca users in base _id e rimango loggato
app.put("/stayLoggedIn", async (req,res)=>{
    let info=req.body
    client.db("palestra").collection("users").findOne({_id:new ObjectId(info._id)}).then(e=>{
        if(!e){
            res.status(500).send("User does not exist, Register!")
        }else{
            res.status(200).send(e)
        }
    })
})
//cerca video in pexels
async function searchPexelsVideos(filter) {
    const response = await axios.get('https://api.pexels.com/videos/search', {headers: {Authorization: API_KEY},params:{query: filter,per_page: 10}}).catch(error=>{
        console.error("Errore con Pexels API:", error.message);
        res.status(500).send("Error with Pexels API")
        return
    })
    return response.data.videos;
}
app.put("/videoSport", async (req,res)=>{
    let info=req.body
    const videos=await searchPexelsVideos(info.filter)
    return videos
})
//get tutti in centri sportivi visivamente sulla mappa
const apiKey = 'AIzaSyAEANncF4i3EqwlSfnRic_oOrpynSTVHIU';
async function getPlaceDetails(placeId,name) {
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website&key=${apiKey}`;
    const response = await axios.get(detailsUrl);
    return response.data.result.website || `https://www.google.com/search?q=${name}`;
}
function getRadiusFromBBox(bbox) {
  const [south, west, north, east] = bbox.split(',').map(Number);
  // Distanza in gradi
  const latDiff = Math.abs(north - south);
  const lngDiff = Math.abs(east - west);
  // Approssimazione: 1° latitudine ≈ 111 km
  const latMeters = latDiff * 111000;
  const lngMeters = lngDiff * 111000 * Math.cos(((south + north) / 2) * Math.PI / 180);
  // Prendiamo la metà della diagonale
  const diagonalMeters = Math.sqrt(latMeters**2 + lngMeters**2);
  return diagonalMeters / 2;
}
function getCenterFromBBox(bbox) {
  const [south, west, north, east] = bbox.split(',').map(Number);
  const lat = (south + north) / 2;
  const lng = (west + east) / 2;
  return { lat, lng };
}
async function searchPlacesWithBoundsGoogle(bbox,filter) {
    const sportQueriesPath = './sportQueries.json';
    const sportQueries =JSON.parse(fs.readFileSync(sportQueriesPath, 'utf8'));
    const query = sportQueries[filter] || filter;
    const { lat, lng } = getCenterFromBBox(bbox);
    const radius = getRadiusFromBBox(bbox);
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?keyword=${encodeURIComponent(query)}&location=${lat},${lng}&radius=${radius}&key=${apiKey}`;
    const response = await axios.get(url);
    const results = response.data.results;
    const places = await Promise.all(results.map(async place => {
        const website = await getPlaceDetails(place.place_id, place.name)
        return {
            id: place.place_id,
            filter: filter,
            name: place.name,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            website: website,
            rating: {
                value: place.rating || 0,
                count: place.user_ratings_total || 0
            },
            opening_hours: place.opening_hours ? {
                open_now: place.opening_hours.open_now,
                periods: place.opening_hours.periods || []
            } : null,
            photos: place.photos?place.photos[0].html_attributions:[]
        };
    }));
    return(places);
}
async function searchPlacesWithBoundsOverpass(bbox,filter){
    const query = filter === "skiing" ? `
        [out:json];
        nwr["route"="piste"](${bbox});
        out geom;
    `:filter==="hiking" ? `
        [out:json];
        (
        nwr["sport"="${filter}"](${bbox})["access"!="private"];
        way["highway"="path"]["sac_scale"]["foot"="yes"]["name"](${bbox});
        way["highway"="footway"]["sac_scale"]["foot"="yes"]["name"](${bbox});
        );
        out geom;
    `:filter==="cycling" ? `
        [out:json];
        (
        nwr["sport"="${filter}"](${bbox})["access"!="private"];
        way["highway"="path"]["bicycle"="yes"]["name"](${bbox});
        );
        out geom;
    `:`
        [out:json];
        nwr["sport"=${filter}](${bbox})["access"!="private"];
        out geom;
    `
    const response= await axios.post('https://overpass-api.de/api/interpreter', query).catch(error=>{
        console.error("Errore con Overpass API:", error.message);
        res.status(500).send("Error with Overpass API")
        return
    });
    const responseWithoutDuplicates = response.data.elements.filter((item, index, self) =>index === self.findIndex(obj => obj.tags.name.toLowerCase() === item.tags.name.toLowerCase()));
    return responseWithoutDuplicates
}
const removeDuplicateMarkers = (markers,markers1) => {
    markers1.forEach((m, index) => {
        const duplicateIndex = markers.findIndex(marker=>marker.tags.name&&((m.name.toLowerCase()===marker.tags.name.toLowerCase())||(stringSimilarity.compareTwoStrings(m.name.toLowerCase().trim(),marker.tags.name.toLowerCase().trim())>0.8)));
        if (duplicateIndex !== -1) {
            markers1.splice(index, 1);
        }
    })
    return markers1
}
async function searchPexelsImages(filter) {
    const API_KEY='FrbSqrAbcjqK5v7P5wsCQymKbGo6L655TmLSvMt329yAnyRCdTEiJIrI'
    const response = await axios.get('https://api.pexels.com/v1/search', {headers: {Authorization: API_KEY},params:{query: filter,per_page: 10}}).catch(error=>{
        console.error("Errore con Pexels API:", error.message);
        res.status(500).send("Error with Pexels API")
        return
    })
    return response.data.photos;
}
app.put("/getBounds", async (req,res)=>{
    const info=req.body
    if(!info.filter){
        res.status(500).send("You have not entered the type of sport")
        return
    }
    const photos=await searchPexelsImages(info.filter)
    const bbox=info.latSw+","+info.lonSw+","+info.latNe+","+info.lonNe
    let markers1=[]//await searchPlacesWithBoundsGoogle(bbox,info.filter)
    const markers=await searchPlacesWithBoundsOverpass(bbox,info.filter)
    if(markers1.length>0&&markers.length>0){
        markers1=removeDuplicateMarkers(markers,markers1)
    }
    for (let item of markers) {
        let x2 = 0, y2 = 0;
        if (item.lat && item.lon) {
            x2 = item.lat;
            y2 = item.lon;
        } else if (item.bounds) {
            x2 = (item.bounds.maxlat + item.bounds.minlat) / 2;
            y2 = (item.bounds.maxlon + item.bounds.minlon) / 2;
        }
        try {
            const nominatimResponse = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${x2}&lon=${y2}`).catch(error=>{
                console.error("Errore con Nominatim:", error.message);
                res.status(500).send("Error with Nominatim")
                return
            });
            item.tags["name"] = item.tags.name || nominatimResponse.data.name || "Public";
            item.tags["website"]=item.tags.website||nominatimResponse.data.website||`https://www.google.com/search?q=${item.tags["name"]} ${nominatimResponse.data.address.postcode} `
        } catch (error) {
            console.error("Errore con Nominatim:", error.message);
            item.tags.name = "Public";
        }
    }
    const dato={
        markers:markers,
        markers1:markers1,
        photos:photos,
    }
    res.send(dato)
})
async function searchGoogleShopping(query) {
    return "ok"
}
app.get("/getShopping/:filter", async (req,res)=>{
    const filter=req.params.filter
    if(!filter){
        res.status(500).send("You have not entered the type of sport")
        return
    }
    const shopping=await searchGoogleShopping(filter).catch(error=>{
        console.error("Errore con Google Shopping:", error.message);
        res.status(500).send("Error with Google Shopping")
        return
    });
    if(!shopping){
        res.status(500).send("Error with Google Shopping API")
        return
    }
    res.send(shopping)
})
//scraping degli esercizi delle parti del corpo
async function fetchExerciseLinks(url) {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const cards = $('.exercise-card-grid__cell a').toArray();
    const results = await Promise.all(cards.map(async (el) => {
        const image = $(el).find('.exercise-card__image').attr('data-lazybg');
        const href = 'https://www.acefitness.org' + $(el).attr('href');
        const title = $(el).find('h2').text().trim();
        const bodyPart = $(el).find('.exercise-info__term--body-part dd').text().trim();
        const equipment = $(el).find('.exercise-info__term--equipment dd').text().trim();
        const description = await fetchExerciseDescription(href);
        return { image, title, url: href, bodyPart, equipment, description };
    }));
    return results;
}

async function fetchExerciseDescription(url) {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const paragraphs=[]
    $('.exercise-post__step-content').find('p').each((_, el) => {
        const p=$(el).text().trim();
        paragraphs.push(p);
    })
    return paragraphs
}
app.put("/getExercises", async (req,res)=>{
    const info=req.body
    const bodyPart=info["body_part[]"]
    if(!bodyPart){
        res.status(500).send("You have not entered the body part")
        return
    }
    const exercises=[]
    for(let i=0;i<bodyPart.length;i++){
        let page=1
        if(bodyPart[i].toLowerCase()!=="neck"){
            page=Math.floor(Math.random() * 3)
        }
        const url="https://www.acefitness.org/resources/everyone/exercise-library/body-part/"+encodeURIComponent(bodyPart[i].toLowerCase()+"/?page="+page)
        const result = await fetchExerciseLinks(url);
        exercises.push({result,bodyPart:bodyPart[i]})
    }
    res.send(exercises)
})
//aggiungi centro sportivo sulla mappa
app.post("/addMarker", async (req,res)=>{
    let info=req.body
    const trasportatore=nodemailer.createTransport({
        service:'gmail', // Puoi specificare il servizio di posta elettronica che stai utilizzando (es. 'gmail', 'hotmail', 'yahoo', ecc.)
        auth:{
            user:'nolomundus@gmail.com', // Inserisci il tuo indirizzo email
            pass:'rclh ruyt cxmy agpk' // Inserisci la tua password
        },
        tls:{
            rejectUnauthorized:false
        }
    });
    const text="<div><p>User: "+info["utente[_id]"]+"</p><p>Coordinates: "+info.lat+", "+info.lon+"</p><p>Sport: "+info.sport+"</p><p>Name: "+info.name+"</p></div>"
    const opzioniEmail={
        from:'nolomundus@gmail.com', // Inserisci il mittente
        to:'nolomundus@gmail.com', // Inserisci il destinatario
        subject:"Add Marker Request by "+info["utente[_id]"],
        html:text // Testo del messaggio
    };
    trasportatore.sendMail(opzioniEmail, function(error, info){
        if(error){
            console.log(error);
            res.status(500).send(error);
        }else{
            res.send("ok");
        }
    });
    
})
//aggiungi centro sportivo sulla mappa
app.put("/addGiudizioCenter", async (req,res)=>{
    let info=req.body
    let tipo
    if(info.giudizio==="0"){
        tipo="buono"
    }else if(info.giudizio==="1"){
        tipo="medio"
    }else if(info.giudizio==="2"){
        tipo="brutto"
    }
    if(info.utenteid==="undefined"){
        error="you are not logged in"
        res.status(500).send(error)
    }else{
        info.utenteid=JSON.parse(info.utenteid)._id
        client.db("palestra").collection("centriSportivo").updateOne({_id:new ObjectId(info.id)},{$push:{[tipo]:info.utenteId}}).then(e=>{
            if(!e){
                res.status(500).send("Something went wrong, try again!")
            }else{
                res.status(200).send("ok")
            }
        })
    }
    
})
//manda richiesta per contattarci
app.put("/sendEmail", async (req,res)=>{
    let info=req.body
    let countError=0
    let error="you have not filled in the field: "
    if(info.email===""){
        countError++
        error=error+"email, "
    }
    if(info.oggetto===""){
        countError++
        error=error+"object, "
    }
    if(info.testo===""){
        countError++
        error=error+"text, "
    }
    if(!info.utenteid){
        countError++
        error="Something went wrong, try again!"
    }
    if(countError>0){
        res.status(500).send(error)
    }else{
        const trasportatore=nodemailer.createTransport({
            service:'gmail', // Puoi specificare il servizio di posta elettronica che stai utilizzando (es. 'gmail', 'hotmail', 'yahoo', ecc.)
            auth:{
                user:'nolomundus@gmail.com', // Inserisci il tuo indirizzo email
                pass:'rclh ruyt cxmy agpk' // Inserisci la tua password
            },
            tls:{
                rejectUnauthorized:false
            }
        });
        const opzioniEmail={
            from:info.email, // Inserisci il mittente
            to:'nolomundus@gmail.com', // Inserisci il destinatario
            subject:info.utenteid+", "+info.oggetto,
            text:info.email+", "+info.testo // Testo del messaggio
        };
        trasportatore.sendMail(opzioniEmail, function(error, info){
            if(error){
                console.log(error);
                res.status(500).send(error);
            }else{
                res.send("ok");
            }
        });
    }
})
//aggiorna dati personale degli users
app.post("/update", async (req,res)=>{
    let info=req.body
    client.db("palestra").collection("users").findOne({_id:new ObjectId(info.id)}).then(e=>{
        if(e){
            const elementToUpdate = info.idModificareKey;
            const valueToUpdate = info.idModificareValue;
            client.db("palestra").collection("users").updateOne({_id:new ObjectId(info.id)},{$set:{[elementToUpdate]:valueToUpdate}})
            res.send("ok");   
        }else{
            res.status(500).send("User does not exist, Register!")
        }
    })
})
//delete users
app.post("/delete", async (req,res)=>{
    let info=req.body
    client.db("palestra").collection("users").deleteOne({_id:new ObjectId(info.id)}).then(e=>{
        if(e.deletedCount>0){
            res.send("ok");   
        }else{
            res.status(500).send("User does not exist")
        }
    })
})