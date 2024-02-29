import cors from "cors"
import express from "express"
import bodyParser from "body-parser"
import {MongoClient,ObjectId} from "mongodb"
import path from "path"
import fileupload from "express-fileupload"
import { uploadFile } from "@uploadcare/upload-client"
import {deleteFile,UploadcareSimpleAuthSchema} from '@uploadcare/rest-client';
import nodemailer from "nodemailer"

const PORT = process.env.PORT|| 3001;
const app=express()
app.use(cors())
app.use(fileupload());
app.use(bodyParser.urlencoded({extended:true}))
app.listen(PORT,()=>{
    console.log("run");
})

const client=new MongoClient("mongodb://apo:jac2001min@cluster0-shard-00-00.pdunp.mongodb.net:27017,cluster0-shard-00-01.pdunp.mongodb.net:27017,cluster0-shard-00-02.pdunp.mongodb.net:27017/?ssl=true&replicaSet=atlas-me2tz8-shard-0&authSource=admin&retryWrites=true&w=majority")
/*const respone=async()=>{
    try{
        let esercizi=[]
        await client.db("palestra").collection("esercizi").find({}).toArray().then(e=>{
            esercizi=e;
        });
        return esercizi
    }catch(error) {
        console.error(error);
    }
}

//////////////USERS//////////////
//leggi tutti gli users
app.get("/users", async (req,res)=>{
    client.db("palestra").collection("users").find({}).toArray().then(e=>res.send(e))
})
//registrati come users
app.put("/signup", async (req,res)=>{
    let info=req.body
    if(info.email===""||info.password===""||info.eta===""||info.sesso===""||info.peso===""||info.altezza===""||info.allenamenti===""||info.obbiettivo===""){
        res.status(203).send("Non hai compilato tutti i campi")
    }
    if(!info.email.includes("@")){
        res.status(203).send("Email non valida")
    }
    client.db("palestra").collection("users").findOne({password:info.password,email:info.email}).then(e=>{
        if(!e){
            info["_id"]=new ObjectId()
            info.altezza=[info.altezza]
            info.peso=[info.peso]
            client.db("palestra").collection("users").insertOne(info).then((e)=>{
                res.status(200).send(JSON.stringify(info["_id"]))
            })
        }else{
            res.status(203).send("Utente già esistente")
        }
    })
})
//accedi come users
app.put("/login", async (req,res)=>{
    let info=req.body
    client.db("palestra").collection("users").findOne({password:info.password,email:info.email}).then(e=>{
        if(!e){
            res.status(203).send("Utente non esistente, Registrati!")
        }else{
            res.status(200).send(e._id)
        }
    })
})
//cerca users in base _id e rimango loggato
app.put("/stayLoggedIn", async (req,res)=>{
    let info=req.body
    client.db("palestra").collection("users").findOne({_id:new ObjectId(info._id)}).then(e=>{
        if(!e){
            res.status(203).send("Token non valido")
        }else{
            res.status(200).send(e)
        }
    })
})
//aggiorna dati personale degli users
app.put("/update", async (req,res)=>{
    let info=req.body
    if(info.daAggiornare.length===0){
        res.status(203).send("Non hai modificato nessun parametro")
    }
    for(let aggiorno in info.daAggiornare){
        if((info.daAggiornare[aggiorno].tipo==="peso"||info.daAggiornare[aggiorno].tipo==="altezza")){
            client.db("palestra").collection("users").updateOne({_id:new ObjectId(info.id)},{$push:{[info.daAggiornare[aggiorno].tipo]:info.daAggiornare[aggiorno].valore}}).then(e=>{
                if(!e){
                    res.status(203).send("Qualcosa è andato storto")
                }else{
                    if(aggiorno===4)res.send("ok")
                }
            })
        }else{
            client.db("palestra").collection("users").updateOne({_id:new ObjectId(info.id)},{$set:{[info.daAggiornare[aggiorno].tipo]:info.daAggiornare[aggiorno].valore}}).then(e=>{
                if(!e){
                    res.status(203).send("Qualcosa è andato storto")
                }else{
                    if(aggiorno===4)res.send("ok")
                }
            })
        }

    }
})
//ottieni gli esercizi dall'api
app.get("/exercises", async (req,res)=>{
    await respone().then(e=>{
        if(e){
            res.send(e)
        }else{
            res.status(203).send("Errore verificatosi durante il caricamento degli esercizi. Riprova più tardi!")
        }
    })
})
//crea la scheda di allenamento per i mesi
app.put("/scheda", async (req,res)=>{
    let info=req.body
    const esercizi=[]
    client.db("palestra").collection("users").findOne({_id:new ObjectId(info.id)}).then(e=>{
        if(!e){
            res.status(203).send("Token non valido")
        }else{
            if(e.scheda&&(e.scheda.data>info.data||e.allenamenti!==info.allenamenti||e.obbiettivo!==info.obbiettivo)){
                res.send(e.scheda.esercizi)
            }else{
                respone().then(e=>{
                    if(e){
                        for(let i=0;i<parseInt(info.allenamenti);i++){
                            if(parseInt(info.obbiettivo)===0){
                                esercizi.push({
                                    giorno:i,
                                    esercizi:[
                                    e.filter(i=>i.bodyPart==="back")[Math.floor(Math.random()*e.filter(i=>i.bodyPart==="back").length)],
                                    e.filter(i=>i.bodyPart==="chest")[Math.floor(Math.random()*e.filter(i=>i.bodyPart==="chest").length)],
                                    e.filter(i=>i.bodyPart==="upper arms"&&i.target==="triceps")[Math.floor(Math.random()*e.filter(i=>i.bodyPart==="upper arms"&&i.target==="triceps").length)],
                                    e.filter(i=>i.bodyPart==="upper arms"&&i.target==="biceps")[Math.floor(Math.random()*e.filter(i=>i.bodyPart==="upper arms"&&i.target==="biceps").length)],
                                    e.filter(i=>i.bodyPart==="shoulders")[Math.floor(Math.random()*e.filter(i=>i.bodyPart==="shoulders").length)],
                                    e.filter(i=>i.bodyPart==="lower legs")[Math.floor(Math.random()*e.filter(i=>i.bodyPart==="lower legs").length)],
                                    e.filter(i=>i.bodyPart==="upper legs")[Math.floor(Math.random()*e.filter(i=>i.bodyPart==="upper legs").length)],
                                    e.filter(i=>i.bodyPart==="waist")[Math.floor(Math.random()*e.filter(i=>i.bodyPart==="waist").length)],
                                    ],
                                    serie:"3-5",
                                    ripetizioni:"6-12",
                                    peso:"Utilizza pesi che ti consentano di raggiungere la fatica muscolare entro il numero di ripetizioni desiderato"
                                })
                            }else if(parseInt(info.obbiettivo)===1){
                    
                            }else if(parseInt(info.obbiettivo)===2){
                              
                            }else if(parseInt(info.obbiettivo)===3){
                              
                            }else if(parseInt(info.obbiettivo)===4){
                              
                            }
                        }
                        let date=new Date(info.data)
                        date.setDate(date.getDate() + 30);
                        client.db("palestra").collection("users").updateOne({_id:new ObjectId(info.id)},{$set:{scheda:{data:date,obbiettivo:info.obbiettivo,allenamenti:info.allenamenti,esercizi:esercizi}}}).then(e=>{
                            res.send(esercizi)
                        })
                    }else{
                        res.status(203).send("Errore verificatosi durante il caricamento degli esercizi. Riprova più tardi!")
                    }
                })
            }
        }
    })
})
//cerca gli esercizi adatti all user
app.put("/filter-exercises", async (req,res)=>{
    const esercizi=[]
    let info=req.body
    client.db("palestra").collection("professionisti").find({"esercizi.opzioni.obbiettivo":info.obbiettivo}).toArray().then(e=>{
        if(e){
            e.map(professionista=>{
                professionista.esercizi.map(esercizio=>{
                    if(esercizio.opzioni.obbiettivo===info.obbiettivo){
                        esercizi.push(esercizio);
                    }
                })
            })
            res.status(200).send(esercizi)
        }else{
            res.status(203).send("Esercizi non trovati")
        }
    })
})
//cliccando il video nuovo nella home lo inserisco nei video visti impostandalo come non finito
app.put("/insert-exercise", async (req,res)=>{
    let info=req.body
    
    client.db("palestra").collection("users").updateOne({_id:new ObjectId(info.id)},{$push:{esercizi:{videoId:new ObjectId(info.videoId),video:info.video,categoria:info.categoria,nome:info.nome,finito:false}}}).then(e=>{
        res.status(200).send("OK")
    })
})
//cliccando esercizio completato aggiorno l'esercizio come finito
app.put("/finish-exercise", async (req,res)=>{
    let info=req.body
    
    client.db("palestra").collection("users").updateOne({_id:new ObjectId(info.id),"esercizi.videoId":new ObjectId(info.videoId),"esercizi.finito":false},{$set:{"esercizi.$.finito":true}}).then(e=>{
        res.status(200).send("OK")
    })
})
//cerca il video per vederlo e ritornalo
app.put("/guardaVideo", async (req,res)=>{
    let info=req.body
    client.db("palestra").collection("professionisti").findOne({"esercizi.id":new ObjectId(info.videoId)}).then(e=>{
        if(e){
            e.esercizi.map(esercizio=>{
                if(esercizio.id.toString()===info.videoId){
                    let info={
                        id:e._id,
                        nome:e.nome,
                        cognome:e.cognome,
                        fotoProfilo:e.fotoProfilo,
                        esercizio:esercizio
                    }
                    res.status(200).send(info)
                }
            })
        }else{
            res.status(203).send("Esercizio non trovato")
        }
        
    })
})
//mostra il profilo del professionista selezionato usando il suo id
app.put("/professionistaInfo", async (req,res)=>{
    let info=req.body
    client.db("palestra").collection("professionisti").findOne({"_id":new ObjectId(info.proId)}).then(e=>{
        if(e){
            res.status(200).send(e)
        }else{
            res.status(203).send("Professionista non trovato")
        }
        
    })
})
//mostra il profilo del professionista selezionato usando il suo id
app.get("/sfide", async (req,res)=>{
    client.db("palestra").collection("professionisti").find({}).toArray().then(e=>{
        if(e){
            res.status(200).send(e.filter(prof=>prof.sfide))
        }else{
            res.status(203).send("Professionista non trovato")
        }
        
    })
})
//get tutti centri sportivi da mettere sulla mappa
app.get("/getSportCenter", async (req,res)=>{
    client.db("palestra").collection("centriSportivo").find({}).toArray().then(e=>res.send(e))
})
//aggiungi centro sportivo sulla mappa
app.post("/addSportCenter", async (req,res)=>{
    let info=req.body
    if(req.files){
        if(req.files.file.mimetype.startsWith('image')){
            const filename=req.files.file.name+Date.now()+"."+req.files.file.mimetype.split("/")[1]
        }else{
            res.status(203).send("Puoi inviare solo immagini!")
        }
    }
    let countError=0
    let error="you have not filled in the field: "
    if(info.tipologia==="0"){
        countError++
        error=error+"tipologia, "
    }
    if(info.pubblico==="0"){
        countError++
        error=error+"pubblico, "
    }
    if(countError>0){
        res.status(203).send(error)
    }else{
        info.coordinate=JSON.parse(info.coordinate)
        client.db("palestra").collection("centriSportivo").insertOne(info).then((e)=>{
            res.status(200).send("ok")
        })
    }
    
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
    client.db("palestra").collection("centriSportivo").updateOne({_id:new ObjectId(info.id)},{$push:{[tipo]:info.utenteId}}).then(e=>{
        if(!e){
            res.status(203).send("Something went wrong, try again!")
        }else{
            res.status(200).send("ok")
        }
    })
})

//////////////PROFESSIONISTI//////////////
//registrati come professionista
app.put("/signup-pro", async (req,res)=>{
    let info=req.body
    if(info.email===""||info.password===""||info.nome===""||info.cognome===""||info.cellulare===""||info.professione===""){
        res.status(203).send("Non hai compilato tutti i campi")
    }
    if(!info.email.includes("@")){
        res.status(203).send("Email non valida")
    }
    
    client.db("palestra").collection("professionisti").findOne({password:info.password,email:info.email}).then(e=>{
        if(!e){
            info["_id"]=new ObjectId()
            client.db("palestra").collection("professionisti").insertOne(info).then((e)=>{
                res.status(200).send(JSON.stringify(info["_id"]))
            })
        }else{
            res.status(203).send("Utente già esistente")
        }
    })
})
//accedi come professionista 
app.put("/login-pro", async (req,res)=>{
    let info=req.body
    
    client.db("palestra").collection("professionisti").findOne({password:info.password,email:info.email}).then(e=>{
        if(!e){
            res.status(203).send("Utente non esistente, Registrati!")
        }else{
            res.status(200).send(e._id)
        }
    })
})
//cerca professionista in base _id e rimango loggato
app.put("/stayLoggedInPro", async (req,res)=>{
    let info=req.body
    
    client.db("palestra").collection("professionisti").findOne({_id:new ObjectId(info._id)}).then(e=>{
        if(!e){
            res.status(203).send("Token non valido")
        }else{
            res.status(200).send(e)
        }
    })
})
//aggiorna dati personale dei professionisti
app.put("/update-pro", async (req,res)=>{
    let info=req.body
    if(info.tipo==="email"&&info.valore!=""){
        if(info.valore.includes("@")){
            client.db("palestra").collection("professionisti").updateOne({_id:new ObjectId(info.id)},{$set:{[info.tipo]:info.valore}})
            res.status(200)
        }else{
            res.status(203).send("Email non valida")
        } 
    }
    else if(info.tipo==="cellulare"&&info.valore!=""){
        if(info.valore.length===10){
            client.db("palestra").collection("professionisti").updateOne({_id:new ObjectId(info.id)},{$set:{[info.tipo]:info.valore}})
            res.status(200)
        }else{
            res.status(203).send("Numero di telefono non valido")
        }
    }
    else if(info.tipo==="instagram"&&info.valore!=""){
        client.db("palestra").collection("professionisti").updateOne({_id:new ObjectId(info.id)},{$set:{[info.tipo]:info.valore}})
        res.status(200)
    }
})
//aggiorna foto profilo
app.post('/fotoProfilo/:id', upload.single('avatar'), function (req, res) {
    
    client.db("palestra").collection("professionisti").findOne({_id:new ObjectId(req.params.id)}).then((e)=>{
        fs.unlinkSync("./uploads/"+e.fotoProfilo);
        client.db("palestra").collection("professionisti").updateOne({_id:new ObjectId(req.params.id)},{$set:{fotoProfilo:req.file.filename}}).then((e)=>{
            res.redirect("http://localhost:3000/")
        })
    })
    
})
//mostra foto profilo
app.get('/mostraFotoProfilo/:filename',function (req, res) {
    res.sendFile("/uploads/"+req.params.filename,{ root: __dirname })
})
//aggiungi video per esercizi
app.post('/addVideoEsercizio/:id/', uploadVideo.single('my-video'), function (req, res) {
    const videoId=new ObjectId()
    
    client.db("palestra").collection("professionisti").updateOne({_id:new ObjectId(req.params.id)},{$push:{esercizi:{id:videoId,video:req.file.filename}}}).then((e)=>{
        res.status(200).redirect("http://localhost:3000/aggiungi-video/"+videoId)
    })
})
//modifica video per esercizi
app.post('/modificaVideoEsercizio/:id/:videoId/:filename', uploadVideo.single('my-video'), function (req, res) {
    
    client.db("palestra").collection("professionisti").updateOne({_id:new ObjectId(req.params.id),"esercizi.id":new ObjectId(req.params.videoId)},{$set:{"esercizi.$.video":req.file.filename}}).then((e)=>{
        fs.unlinkSync("./uploads/"+req.params.filename)
        res.status(200).redirect("http://localhost:3000/esercizio/"+req.params.videoId)
    })
})
//aggiungi altri dati al video inserito precedentemente per esercizi
app.put('/addEsercizio', async (req,res)=>{
    let info=req.body
    if(info.opzioni.nome!==""&&info.opzioni.categoria!==""&&info.opzioni.gruppi!==""&&info.opzioni.obbiettivo!==""&&info.opzioni.descrizione!==""){
        client.db("palestra").collection("professionisti").updateOne({_id:new ObjectId(info.id),"esercizi.id":new ObjectId(info.videoId)},{$set:{"esercizi.$.opzioni":info.opzioni}}).then((e)=>{
            res.status(200).send("ok")
        })
    }else{
        res.status(203).send("Non tutti i campi sono stati compilati")
    }
})
//mostra video tramite filename
app.get('/mostraVideo/:filename',function (req, res) {
    res.sendFile("/uploads/"+req.params.filename,{ root: __dirname })
})
//elimina video tramite id
app.put('/eliminaVideo',function (req, res) {
    let info=req.body
    
    client.db("palestra").collection("professionisti").updateOne({_id:new ObjectId(info.id)},{$pull:{esercizi:{id:new ObjectId(info.videoId)}}}).then((e)=>{
        fs.unlinkSync("./uploads/"+info.video)
        res.status(200).send("ok")
    })
})
//ecerca video tramite id e vedi se esiste e ritornalo
app.put('/cercaVideo',function (req, res) {
    let info=req.body
    
    client.db("palestra").collection("professionisti").findOne({_id:new ObjectId(info.id),"esercizi.id":new ObjectId(info.videoId)}).then((e)=>{
        if(e){
            res.status(200).send(e.esercizi.filter(i=>{return i.id.toString()===info.videoId}))
        }else{
            res.status(203).send("Opss... esercizio non esistente")
        }
        
    })
})
*/
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
        res.status(203).send(error)
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
                res.status(203).send("Already existing user")
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
        res.status(203).send(error)
    }else{
        client.db("palestra").collection("users").findOne({password:info.password,email:info.email}).then(e=>{
            if(!e){
                res.status(203).send("User does not exist, Register!")
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
            res.status(203).send("User does not exist, Register!")
        }else{
            res.status(200).send(e)
        }
    })
})
//get tutti centri sportivi da mettere sulla mappa
app.get("/getSportCenter", async (req,res)=>{
    client.db("palestra").collection("centriSportivo").find({}).toArray().then(e=>res.send(e))
})
//aggiungi centro sportivo sulla mappa
app.post("/addSportCenter", async (req,res)=>{
    let info=req.body
    let countError=0
    let filename
    let error="you have not filled in the field: "
    if(info.tipologia==="0"){
        countError++
        error=error+"typology, "
    }
    if(info.pubblico==="0"){
        countError++
        error=error+"public, "
    }
    if(req.files){
        if(req.files.file.mimetype.startsWith('image')){
            filename=req.files.file.name+Date.now()+"."+req.files.file.mimetype.split("/")[1]
        }else{
            countError++
            error="You can only insert images"
        }
    }
    if(info.utenteid==="undefined"){
        countError++
        error="you are not logged in"
    }
    if(countError>0){
        res.status(203).send(error)
    }else{
        if(req.files){
            const result = uploadFile(req.files.file.data, {
                publicKey: '8cff886cb01a8f787891', 
                store: 1,
                fileName:filename
            }).then(e=>{
                if(e){
                    info.coordinate=JSON.parse(info.coordinate)
                    info.utenteid=JSON.parse(info.utenteid)._id
                    info.src="https://ucarecdn.com/"+e.uuid+"/-/resize/1200x/-/quality/smart/-/format/auto/"+filename
                    client.db("palestra").collection("centriSportivo").insertOne(info).then((e)=>{
                        res.status(200).send("ok")
                    })
                }else{
                    res.status(203).send("Something went wrong, try again!")
                }
            })
        }else{
            info.coordinate=JSON.parse(info.coordinate)
            info.utenteid=JSON.parse(info.utenteid)._id
            client.db("palestra").collection("centriSportivo").insertOne(info).then((e)=>{
                res.status(200).send("ok")
            })
        }
    }
    
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
        res.status(203).send(error)
    }else{
        info.utenteid=JSON.parse(info.utenteid)._id
        client.db("palestra").collection("centriSportivo").updateOne({_id:new ObjectId(info.id)},{$push:{[tipo]:info.utenteId}}).then(e=>{
            if(!e){
                res.status(203).send("Something went wrong, try again!")
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
        res.status(203).send(error)
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
                res.status(203).send(error);
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
                res.status(203).send("Non hai modificato nessun parametro")
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
            res.status(203).send("User does not exist, Register!")
        }
    })
})