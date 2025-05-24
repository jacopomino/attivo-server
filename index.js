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
import sportQueriesJson from "./sportQueries.json" assert {type: "json"};


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
    if(info.eta===""){
        countError++
        error=error+"age, "
    }
    if(info.sesso===""){
        countError++
        error=error+"gender, "
    }
    if(info.impianto===""){
        countError++
        error=error+"sports facilitie, "
    }
    if(countError>0){
        res.status(500).send(error)
    }
    else{
        client.db("palestra").collection("users").findOne({password:info.password,email:info.email}).then(e=>{
            if(!e){
                info["_id"]=new ObjectId()
                info.altezza=[info.altezza]
                info.peso=[info.peso]
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
//get tutti in centri sportivi visivamente sulla mappa
const apiKey = 'AIzaSyAEANncF4i3EqwlSfnRic_oOrpynSTVHIU';
async function getPlaceDetails(placeId) {
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website&key=${apiKey}`;
    const response = await axios.get(detailsUrl);
    return response.data.result.website || 'N|A';
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
    const sportQueries = sportQueriesJson
    const query = sportQueries[filter] || filter;
    const { lat, lng } = getCenterFromBBox(bbox);
    const radius = getRadiusFromBBox(bbox);
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?keyword=${encodeURIComponent(query)}&location=${lat},${lng}&radius=${radius}&key=${apiKey}`;
    const response = await axios.get(url);
    const results = response.data.results;
    const places = await Promise.all(results.map(async place => {
        const website = await getPlaceDetails(place.place_id);
        return {
            filter: filter,
            name: place.name,
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            website: website,
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
        way["highway"="path"](${bbox})["access"!="private"];
        way["highway"="footway"](${bbox})["access"!="private"];
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
    return response.data.elements
}
async function searchWikiHow(filter){
    const response = await axios.get(`https://www.wikihow.com/api.php?action=query&format=json&list=search&srsearch=${filter}`).catch(error=>{
        console.error("Errore con WikiHow API:", error.message);
        res.status(500).send("Error with WikiHow API")
        return
    })
    const contenuto = response.data.query.search;
    return contenuto;
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
async function searchPexelsVideos(filter) {
    const API_KEY='FrbSqrAbcjqK5v7P5wsCQymKbGo6L655TmLSvMt329yAnyRCdTEiJIrI'
    const response = await axios.get('https://api.pexels.com/videos/search', {headers: {Authorization: API_KEY},params:{query: filter,per_page: 10}}).catch(error=>{
        console.error("Errore con Pexels API:", error.message);
        res.status(500).send("Error with Pexels API")
        return
    })
    return response.data.videos;
}
async function searchGoogleShopping(query) {
    try {
        const url = `https://www.google.com/search?tbm=shop&hl=en&q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
        });
        const $ = cheerio.load(data);
        let products = [];
        $('.sh-dgr__content').each((index, element) => {
            const title = $(element).find('.tAxDx').text().trim();
            const price = $(element).find('.a8Pemb').text().trim().replace(/[^\d,.]/g, '').replace(',', '.');
            const store = $(element).find('.aULzUe').text().trim() || "Unknown Store"
            const link = $(element).find('a').attr('href');
            let directLink = "N/A";
            $(element).find('a').each((i, el) => {
                const href = $(el).attr('href');
                if (href && href.includes('url=')) {
                    directLink = decodeURIComponent(href.split('url=')[1].split('&')[0]);
                }
            });
            if (title && price) {
                products.push({
                    title,
                    price,
                    store: store,
                    link: link ? `https://www.google.com${link}`: "N/A",
                    directLink
                });
            }
        });
        return (products);
    } catch (error) {
        return
    }
}
app.put("/getBounds", async (req,res)=>{
    const info=req.body
    if(!info.filter){
        res.status(500).send("You have not entered the type of sport")
        return
    }
    const bbox=info.latSw+","+info.lonSw+","+info.latNe+","+info.lonNe
    const markers1=await searchPlacesWithBoundsGoogle(bbox,info.filter)
    const markers = await searchPlacesWithBoundsOverpass(bbox,info.filter)
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
    const contenuto = await searchWikiHow(info.filter);
    const img=await searchPexelsImages(info.filter)
    const video=await searchPexelsVideos(info.filter)
    const shopping=await searchGoogleShopping(info.filter).catch(error=>{
        console.error("Errore con Google Shopping:", error.message);
        res.status(500).send("Error with Google Shopping")
        return
    });
    const dato={
        markers:markers,
        markers1:markers1,
        contenuto:contenuto,
        img:img,
        video:video,
        shopping:shopping
    }
    res.send(dato)
})
app.put("/getShopping", async (req,res)=>{
    const info=req.body
    if(!info.filter){
        res.status(500).send("You have not entered the type of sport")
        return
    }
    const shopping=await searchGoogleShopping(info.filter).catch(error=>{
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
//richiedi informazioni su gli esercizi
app.put("/getWikiHow", async (req,res)=>{
    const info=req.body
    if(!info.filter){
        res.status(500).send("You have not entered the type of sport")
        return
    }
    const contenuto = await searchWikiHow(info.filter);
    if(!contenuto){
        res.status(500).send("Error with WikiHow API")
        return
    }
    res.send(contenuto)
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
    const text="<div><p>Coordinates: "+info.lat+", "+info.lon+"</p><p>Sport: "+info.sport+"</p></div>"
    const opzioniEmail={
        from:'nolomundus@gmail.com', // Inserisci il mittente
        to:'nolomundus@gmail.com', // Inserisci il destinatario
        subject:"Add Marker",
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
            if(e.impianto===info.impianto&&e.sesso===info.sesso){
                res.status(500).send("Non hai modificato nessun parametro")
            }else{
                if(e.sesso!==info.sesso){
                    client.db("palestra").collection("users").updateOne({_id:new ObjectId(info.id)},{$set:{sesso:info.sesso}})
                }
                if(e.impianto!==info.impianto){
                    client.db("palestra").collection("users").updateOne({_id:new ObjectId(info.id)},{$set:{impianto:info.impianto}})
                }
                res.send("ok")
            }
        }else{
            res.status(500).send("User does not exist, Register!")
        }
    })
})