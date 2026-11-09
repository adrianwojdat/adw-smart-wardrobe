import {SMTPServer} from 'smtp-server';
import nodemailer from 'nodemailer';
import {createServer} from 'node:http';
if(process.env.DEV_MAIL_RELAY!=='true')throw Error('Development mail relay must be explicitly enabled');
if(!process.env.DEV_SMTP_HOST||!process.env.DEV_SMTP_USER||!process.env.DEV_SMTP_PASS)throw Error('Missing development SMTP configuration');
const transport=nodemailer.createTransport({host:process.env.DEV_SMTP_HOST,port:Number(process.env.DEV_SMTP_PORT||1025),secure:false,ignoreTLS:true,authMethod:'LOGIN',auth:{user:process.env.DEV_SMTP_USER,pass:process.env.DEV_SMTP_PASS},connectionTimeout:10000,socketTimeout:20000,logger:false,debug:false});
const smtp=new SMTPServer({name:'wardrobe-dev-mail',secure:false,authOptional:true,disabledCommands:['AUTH','STARTTLS'],size:5*1024*1024,maxClients:5,logger:false,
 onData(stream,session,callback){const chunks=[];let size=0;stream.on('data',part=>{size+=part.length;if(size<=5*1024*1024)chunks.push(part);});stream.on('error',()=>callback(new Error('Message stream failed')));stream.on('end',async()=>{if(stream.sizeExceeded||size>5*1024*1024)return callback(new Error('Message too large'));try{const info=await transport.sendMail({envelope:{from:session.envelope.mailFrom?.address||'',to:session.envelope.rcptTo.map(r=>r.address)},raw:Buffer.concat(chunks)});console.log(JSON.stringify({event:'forwarded',messageId:info.messageId,accepted:info.accepted.length}));callback();}catch(error){console.error(JSON.stringify({event:'forward_failed',code:error.code,responseCode:error.responseCode}));callback(new Error('Development SMTP forwarding failed'));}});}
});
smtp.on('error',()=>console.error(JSON.stringify({event:'smtp_error'})));
smtp.listen(1025,'0.0.0.0');const health=createServer((_req,res)=>res.end('ok')).listen(3000,'0.0.0.0');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{health.close();smtp.close(()=>{transport.close();process.exit(0);});});
