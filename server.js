// iGenss resume portal: upload -> local resume parsing -> mask detected companies -> iGen template
const express=require('express'),multer=require('multer');
const crypto=require('crypto'),fs=require('fs'),os=require('os'),path=require('path');
const {execFile}=require('child_process'),mammoth=require('mammoth'),pdf=require('pdf-parse'),D=require('docx');
const E=process.env,TTL=10*60*1000,jobs=new Map();
const app=express();

const up=multer({storage:multer.memoryStorage(),limits:{fileSize:10e6}});
const LOGO_PATH=path.join(__dirname,'public/logo.jpg');
const LOGO_BUF=fs.existsSync(LOGO_PATH)?fs.readFileSync(LOGO_PATH):null;
const LOGO_B64=LOGO_BUF?'data:image/jpeg;base64,'+LOGO_BUF.toString('base64'):'';

async function extractText(f){
 const n=f.originalname.toLowerCase();
 let text;
 if(n.endsWith('.pdf'))text=(await pdf(f.buffer)).text;
 else if(n.endsWith('.docx'))text=(await mammoth.extractRawText({buffer:f.buffer})).value;
 else if(n.endsWith('.txt'))text=f.buffer.toString('utf8');
 else throw new Error('Please upload a PDF, DOCX or TXT file.');
 if(!text.trim())throw new Error('No readable text was found. Scanned PDFs need OCR; upload a searchable PDF, DOCX or TXT file.');
 return text;
}

const SECTION_RULES=[
 {section:'profile',pattern:/^(?:(?:professional|career)\s+)?(?:summary|profile|objective|about me|career highlights)$/i},
 {section:'skills',pattern:/^(?:(?:core|technical|key)\s+)?(?:skills|competencies|tools|technologies|expertise|areas of expertise)(?:\s*(?:&|and)\s*(?:skills|competencies|tools|technologies|expertise))?$/i},
 {section:'experience',pattern:/^(?:(?:professional|work|employment|career)\s+)?(?:experience|history|projects?|project history|employment)$/i},
 {section:'education',pattern:/^(?:education|academic background|qualifications|education and training)$/i},
 {section:'contact',pattern:/^(?:personal details|contact|contact details|contact information)$/i},
 {section:'other',pattern:/^(?:certifications?|languages|awards|achievements|interests|publications|training)$/i}
];
const ROLE_TERMS=/\b(?:engineer|developer|manager|analyst|consultant|designer|architect|specialist|administrator|technician|director|lead|officer|executive|scientist|coordinator|accountant|nurse|teacher|recruiter|sales|marketing|qa|test|product owner|scrum master|intern)\b/i;
const YEAR='(?:19|20)\\d{2}',MONTH='(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?';
const PERIOD_RE=new RegExp(`\\b(?:(?:${MONTH})\\s+)?${YEAR}(?:\\s*(?:[-–—]|to)\\s*(?:(?:${MONTH})\\s+)?${YEAR}|\\s*(?:[-–—]|to)\\s*(?:present|current|now))?\\b`,'i');
const PERIOD_RANGE_RE=new RegExp(`\\b(?:(?:${MONTH})\\s+)?${YEAR}\\s*(?:[-–—]|to)\\s*(?:(?:${MONTH})\\s+)?${YEAR}|\\b(?:(?:${MONTH})\\s+)?${YEAR}\\s*(?:[-–—]|to)\\s*(?:present|current|now)\\b`,'i');

function stripBullet(line){
 return String(line).replace(/^\s*(?:[•●▪◦‣*]|\d+[.)]|[-–—])\s+/,'').trim();
}

function isBullet(line){
 return /^\s*(?:[•●▪◦‣*]|\d+[.)]|[-–—])\s+/.test(line);
}

function sectionFor(line){
 const heading=line.replace(/^\d+(?:\.\d+)*[.)]?\s*/,'').replace(/[:：]\s*$/,'').trim().replace(/\s+/g,' ');
 return SECTION_RULES.find(rule=>rule.pattern.test(heading));
}

function isContactLine(line){
 return /(?:\b\S+@\S+\.\S+\b|https?:\/\/|www\.)/i.test(line)
  || /^(?:e-?mail|phone|mobile|tel(?:ephone)?|linkedin|website|portfolio|contact)\s*[:|]/i.test(line)
  || /^\+?[\d\s().-]{7,}$/.test(line);
}

function isHeaderRecord(line){
 const text=stripBullet(line);
 return !isBullet(line)&&text.length>0&&text.length<=100&&!/[.!?]$/.test(text);
}

function findLabel(lines,pattern){
 for(const line of lines){
  const match=stripBullet(line).match(pattern);
  if(match)return match[1].trim();
 }
 return '';
}

function parseProject(block){
 const records=block.map(raw=>({raw,text:stripBullet(raw)})).filter(record=>record.text);
 const used=new Set();
 const field=(pattern)=>{
  for(let i=0;i<records.length;i++){
   const match=records[i].text.match(pattern);
   if(match){used.add(i);return match[1].trim();}
  }
  return '';
 };
 let company=field(/^(?:company|employer|client|organisation|organization)\s*[:\-]\s*(.+)$/i);
 let role=field(/^(?:job\s+)?(?:role|position|title)\s*[:\-]\s*(.+)$/i);
 const location=field(/^(?:location|based in)\s*[:\-]\s*(.+)$/i);
 const description=field(/^(?:description|project)\s*[:\-]\s*(.+)$/i);
 let period='';

 for(let i=0;i<records.length;i++){
  if(used.has(i))continue;
  const match=records[i].text.match(PERIOD_RE);
  if(!match)continue;
  period=match[0];
  const remainder=records[i].text.replace(match[0],'').replace(/^[\s()[\],|–—-]+|[\s()[\],|–—-]+$/g,'').trim();
  if(remainder)records[i].text=remainder;
  else used.add(i);
  break;
 }

 if(!role){
  const index=records.findIndex((record,i)=>!used.has(i)&&isHeaderRecord(record.raw)&&ROLE_TERMS.test(record.text));
  if(index>=0){role=records[index].text;used.add(index);}
 }
 if(!company){
  const companyWords=/\b(?:inc\.?|llc|ltd\.?|limited|corp\.?|corporation|company|co\.|plc|gmbh|bank|university|hospital|technologies|solutions|services|group|institute|agency|foundation)\b/i;
  let index=records.findIndex((record,i)=>!used.has(i)&&isHeaderRecord(record.raw)&&companyWords.test(record.text));
  if(index<0&&role)index=records.findIndex((record,i)=>!used.has(i)&&isHeaderRecord(record.raw)&&!isContactLine(record.text));
  if(index>=0){company=records[index].text;used.add(index);}
 }

 const bullets=records.filter((_,i)=>!used.has(i)).map(record=>record.text);
 return {company,period,role,location,description,bullets};
}

function parseEducation(lines){
 const blocks=[];
 let current=[];
 for(const line of lines){
  if(!line.trim()){
   if(current.length){blocks.push(current);current=[];}
  }else current.push(line);
 }
 if(current.length)blocks.push(current);
 return blocks.map(block=>{
  const records=block.map(stripBullet).filter(Boolean);
  let institution=findLabel(records,/^(?:institution|school|university)\s*[:\-]\s*(.+)$/i);
  let degree=findLabel(records,/^(?:degree|qualification)\s*[:\-]\s*(.+)$/i);
  const periodRecord=records.find(line=>PERIOD_RE.test(line));
  const period=periodRecord?(periodRecord.match(PERIOD_RE)||[])[0]:'';
  const used=new Set();
  records.forEach((line,index)=>{
   if(/^(?:institution|school|university|degree|qualification)\s*[:\-]/i.test(line)||line===periodRecord)used.add(index);
  });
  if(!institution){
   const index=records.findIndex((line,i)=>!used.has(i));
   if(index>=0){institution=records[index];used.add(index);}
  }
  if(!degree){
   degree=records.filter((_,i)=>!used.has(i)).join(' | ');
  }
  return {institution,degree,period};
 }).filter(entry=>entry.institution||entry.degree||entry.period);
}

function parse(text){
 const sections={header:[],profile:[],skills:[],experience:[],education:[],contact:[],other:[]};
 let current='header';
 for(const raw of String(text||'').replace(/\f/g,'\n').replace(/\r\n?/g,'\n').split('\n')){
  const line=raw.replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();
  if(!line){
   if(sections[current].length&&sections[current][sections[current].length-1]!=='')sections[current].push('');
   continue;
  }
  const heading=sectionFor(line);
  if(heading){
   current=heading.section;
   if(current==='other')sections.other.push(line.replace(/[:：]$/,'')+':');
   continue;
  }
  sections[current].push(line);
 }

 const headerParts=sections.header.flatMap(line=>line.split(/\s*(?:\||•|·|–|—)\s*|\s+-\s+/).map(part=>part.trim()).filter(Boolean));
 const explicitName=findLabel(headerParts,/^name\s*[:\-]\s*(.+)$/i);
 const explicitTitle=findLabel(headerParts,/^(?:title|position)\s*[:\-]\s*(.+)$/i);
 const headerCandidates=headerParts.map(line=>line.replace(/^(?:name|title|position)\s*[:\-]\s*/i,'').trim())
  .filter(line=>line&&!isContactLine(line)&&!/^(?:curriculum vitae|resume|résumé|cv|professional cv|professional resume)$/i.test(line)&&!/^(?:nationality|citizenship|location|address|based in|lives)\s*[:\-]/i.test(line));
 const name=explicitName||headerCandidates.find(line=>{
  const words=line.split(/\s+/);
  return words.length>=2&&words.length<=5&&!ROLE_TERMS.test(line)&&!/[,:]$/.test(line);
 })||'';
 const title=explicitTitle||headerCandidates.find(line=>line!==name&&ROLE_TERMS.test(line))||'';
 const detailLines=[...sections.header,...sections.contact];
 const nationality=findLabel(detailLines,/^(?:nationality|citizenship)\s*[:\-]\s*(.+)$/i);
 const location=findLabel(detailLines,/^(?:location|address|based in|lives)\s*[:\-]\s*(.+)$/i);
 const headerProfile=headerCandidates.filter(line=>line!==name&&line!==title);
 const profile=[...sections.profile,...sections.other].map(stripBullet).filter(Boolean);
 if(!profile.length)profile.push(...headerProfile);

 const skills=sections.skills.map(stripBullet).filter(Boolean).map(line=>{
  const match=line.match(/^([^:]{1,60})\s*:\s*(.+)$/);
  return match?{label:match[1].trim(),value:match[2].trim()}:{label:'Skills',value:line};
 });
 const experience=[];
 let currentEntry=[];
 for(const line of sections.experience){
  if(!line.trim())continue;
  if(PERIOD_RANGE_RE.test(line)&&currentEntry.some(entry=>PERIOD_RANGE_RE.test(entry))){
   const pending=[];
   while(currentEntry.length&&pending.length<2&&isHeaderRecord(currentEntry[currentEntry.length-1]))pending.unshift(currentEntry.pop());
   if(currentEntry.length)experience.push(parseProject(currentEntry));
   currentEntry=pending;
  }
  currentEntry.push(line);
 }
 if(currentEntry.length)experience.push(parseProject(currentEntry));

 const companies=[...new Set(experience.map(entry=>entry.company).filter(Boolean))];
 return {
  name,title,tagline:'',fullTitle:title,nationality,location,profile,skills,
  projects:experience,education:parseEducation(sections.education),companies
 };
}

function mask(d){
 const names=[...new Set((d.companies||[]).filter(s=>s&&s.length>2))].sort((a,b)=>b.length-a.length)
  .map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 const re=names.length?new RegExp('\\b('+names.join('|')+')\\b','gi'):null;
 const walk=v=>typeof v==='string'?(re?v.replace(re,'the client'):v):Array.isArray(v)?v.map(walk):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,k==='companies'?[]:walk(x)])):v;
 return walk(d);
}

async function buildDocx(d){
 const FONT='Calibri',COLOR_TEXT='404040',COLOR_BLACK='000000';
 const run=(t,o={})=>new D.TextRun({text:String(t??''),font:FONT,size:o.sz||22,color:o.color||COLOR_TEXT,bold:!!o.bold,italics:!!o.italics});
// Footer: line 1 = www.igenss.com (hyperlink), line 2 = "Page X of Y"
function mkFooter(){
 const o={sz:18,color:'404040'};
 const t=c=>new D.TextRun({children:c,font:FONT,size:18,color:'404040'});
 return new D.Footer({children:[
  new D.Paragraph({alignment:D.AlignmentType.CENTER,spacing:{before:0,after:0},children:[
   new D.ExternalHyperlink({link:'https://www.igenss.com',children:[new D.TextRun({text:'www.igenss.com',font:FONT,size:18,color:'404040',underline:{}})]})]}),
  new D.Paragraph({alignment:D.AlignmentType.CENTER,spacing:{before:0,after:0},children:[
   run('Page ',o),t([D.PageNumber.CURRENT]),run(' of ',o),t([D.PageNumber.TOTAL_PAGES])]})
 ]});
}
 const p=(children,o={})=>new D.Paragraph({alignment:o.al||D.AlignmentType.LEFT,spacing:{before:o.before??0,after:o.after??80},tabStops:o.tabStops,keepNext:!!o.keepNext,children:Array.isArray(children)?children:[children]});
 const secHeading=t=>new D.Paragraph({keepNext:true,spacing:{before:240,after:140},children:[run(t.toUpperCase(),{bold:true,sz:22,color:COLOR_BLACK})]});

 const bullet=text=>{
  const colonIdx=text.indexOf(': ');
  if(colonIdx>0&&colonIdx<80){
   return new D.Paragraph({
    numbering:{reference:'b',level:0},
    alignment:D.AlignmentType.BOTH,
    spacing:{after:80},
    children:[
     run(text.slice(0,colonIdx+1),{bold:true,sz:22,color:COLOR_BLACK}),
     run(text.slice(colonIdx+1),{sz:22,color:COLOR_TEXT})
    ]
   });
  }
  return new D.Paragraph({
   numbering:{reference:'b',level:0},
   alignment:D.AlignmentType.BOTH,
   spacing:{after:80},
   children:[run(text,{sz:22,color:COLOR_TEXT})]
  });
 };

 const kids=[];

 // 1. COVER PAGE
 if(LOGO_BUF){
  kids.push(new D.Paragraph({
   alignment:D.AlignmentType.CENTER,
   spacing:{before:800,after:720},
   children:[new D.ImageRun({type:'jpg',data:LOGO_BUF,transformation:{width:301,height:302},altText:{title:'iGen',description:'iGen logo',name:'logo'}})]
  }));
 }

 kids.push(
  p(run('CURRICULUM VITAE',{bold:true,sz:36,color:COLOR_BLACK}),{al:D.AlignmentType.CENTER,after:720}),
  p(run((d.name||'').toUpperCase(),{bold:true,sz:36,color:COLOR_BLACK}),{al:D.AlignmentType.CENTER,after:720}),
  p(run(d.title||'',{bold:true,sz:36,color:COLOR_BLACK}),{al:D.AlignmentType.CENTER,after:240})
 );
 if(d.tagline){
  kids.push(p(run(d.tagline,{bold:true,sz:36,color:COLOR_BLACK}),{al:D.AlignmentType.CENTER,after:240}));
 }

 kids.push(new D.Paragraph({children:[new D.PageBreak()]}));

 // 2. PAGE 2 HEADER
 kids.push(
  p(run('CURRICULUM VITAE',{bold:true,sz:22,color:COLOR_BLACK}),{al:D.AlignmentType.CENTER,after:200}),
  p(run(d.name||'',{bold:false,sz:24,color:COLOR_BLACK}),{al:D.AlignmentType.CENTER,after:200})
 );
 const subHead=d.fullTitle||(d.title&&d.tagline?`${d.title} | ${d.tagline}`:(d.title||''));
 if(subHead){
  kids.push(p(run(subHead,{bold:true,sz:22,color:COLOR_BLACK}),{al:D.AlignmentType.CENTER,after:300}));
 }

 // 3. PERSONAL DETAILS
 kids.push(secHeading('PERSONAL DETAILS'));
 if(d.nationality){
  kids.push(p([run('Nationality:\t',{bold:false,sz:22,color:COLOR_BLACK}),run(d.nationality,{sz:22,color:COLOR_BLACK})],{tabStops:[{type:D.TabStopType.LEFT,position:1700}],after:60}));
 }
 if(d.location){
  kids.push(p([run('Lives:\t',{bold:false,sz:22,color:COLOR_BLACK}),run(d.location,{sz:22,color:COLOR_BLACK})],{tabStops:[{type:D.TabStopType.LEFT,position:1700}],after:120}));
 }

 // 4. PROFILE
 if(d.profile&&d.profile.length){
  kids.push(secHeading('PROFILE'));
  for(const item of d.profile)kids.push(bullet(item));
 }

 // 5. CORE SKILLS & TOOLS
 if(d.skills&&d.skills.length){
  kids.push(secHeading('CORE SKILLS & TOOLS'));
  for(const s of d.skills){
   kids.push(p([run((s.label||'') +':\t',{bold:true,sz:22,color:COLOR_BLACK}),run(s.value||'',{sz:22,color:COLOR_BLACK})],{tabStops:[{type:D.TabStopType.LEFT,position:2600}],after:80}));
  }
 }

 // 6. PROJECT HISTORY
 if(d.projects&&d.projects.length){
  kids.push(secHeading('PROJECT HISTORY'));
  for(const j of d.projects){
   kids.push(p([run(j.company||j.title||'',{bold:true,sz:22,color:COLOR_BLACK}),run(j.period?'\t'+j.period:'',{bold:true,sz:22,color:COLOR_BLACK})],{
    tabStops:[{type:D.TabStopType.RIGHT,position:8640}],before:200,after:40,keepNext:true
   }));
   if(j.role)kids.push(p(run(j.role,{bold:true,sz:22,color:COLOR_BLACK}),{after:60,keepNext:true}));
   if(j.location)kids.push(p(run('Location: '+j.location,{sz:22,color:COLOR_BLACK}),{after:60,keepNext:true}));
   if(j.description)kids.push(p(run('Description: '+j.description,{sz:22,color:COLOR_BLACK}),{after:80,keepNext:true}));
   for(const b of(j.bullets||[])){
    kids.push(new D.Paragraph({
     numbering:{reference:'b',level:0},alignment:D.AlignmentType.BOTH,spacing:{after:60},children:[run(b,{sz:22,color:COLOR_TEXT})]
    }));
   }
  }
 }

 // 7. EDUCATION
 if(d.education&&d.education.length){
  kids.push(secHeading('EDUCATION'));
  for(const edu of d.education){
   kids.push(p([run(edu.institution||'',{bold:false,sz:22,color:COLOR_BLACK}),run(edu.period?'\t'+edu.period:'',{bold:false,sz:22,color:COLOR_BLACK})],{
    tabStops:[{type:D.TabStopType.RIGHT,position:8640}],before:100,after:40,keepNext:true
   }));
   if(edu.degree)kids.push(p(run(edu.degree,{bold:false,sz:22,color:COLOR_BLACK}),{after:120}));
  }
 }

 const doc=new D.Document({
  title:'Curriculum Vitae - '+d.name,
  numbering:{config:[{reference:'b',levels:[{level:0,format:D.LevelFormat.BULLET,text:'\u2022',alignment:D.AlignmentType.LEFT,style:{paragraph:{indent:{left:400,hanging:200}}}}]}]},
  sections:[{
   properties:{
    titlePage:true,
    page:{size:{width:12240,height:15840},margin:{top:1440,bottom:1440,left:1797,right:1797,header:709,footer:709}}
   },
   footers:{default:mkFooter(),first:mkFooter()},
   children:kids
  }]
 });

 return D.Packer.toBuffer(doc);
}

function buildHtml(d){
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 let profileHtml='';
 if(d.profile&&d.profile.length){
  profileHtml=`<div class="section-title">PROFILE</div><ul class="bullets">${d.profile.map(p=>{
   const c=p.indexOf(': ');
   if(c>0&&c<80)return `<li><strong>${esc(p.slice(0,c+1))}</strong>${esc(p.slice(c+1))}</li>`;
   return `<li>${esc(p)}</li>`;
  }).join('')}</ul>`;
 }

 let skillsHtml='';
 if(d.skills&&d.skills.length){
  skillsHtml=`<div class="section-title">CORE SKILLS &amp; TOOLS</div><table class="skills-table">${d.skills.map(s=>`
   <tr><td class="skill-label"><strong>${esc(s.label)}:</strong></td><td class="skill-val">${esc(s.value)}</td></tr>
  `).join('')}</table>`;
 }

 let projectsHtml='';
 if(d.projects&&d.projects.length){
  projectsHtml=`<div class="section-title">PROJECT HISTORY</div>${d.projects.map(j=>`
   <div class="project-block">
    <div class="project-header"><span>${esc(j.company||j.title)}</span><span>${esc(j.period||'')}</span></div>
    ${j.role?`<div class="project-role">${esc(j.role)}</div>`:''}
    ${j.location?`<div class="project-meta">Location: ${esc(j.location)}</div>`:''}
    ${j.description?`<div class="project-meta">Description: ${esc(j.description)}</div>`:''}
    ${j.bullets&&j.bullets.length?`<ul class="bullets">${j.bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>`:''}
   </div>
  `).join('')}`;
 }

 let eduHtml='';
 if(d.education&&d.education.length){
  eduHtml=`<div class="section-title">EDUCATION</div>${d.education.map(e=>`
   <div class="edu-block">
    <div class="edu-header"><span>${esc(e.institution)}</span><span>${esc(e.period||'')}</span></div>
    ${e.degree?`<div class="edu-degree">${esc(e.degree)}</div>`:''}
   </div>
  `).join('')}`;
 }

 const subHead=d.fullTitle||(d.title&&d.tagline?`${d.title} | ${d.tagline}`:(d.title||''));

 return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Curriculum Vitae - ${esc(d.name)}</title>
<style>
  @page {
    size: letter;
    margin: 1in 1.248in;
    @bottom-center {
      content: "www.igenss.com" "\\A" "Page " counter(page) " of " counter(pages);
      white-space: pre;
      font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif;
      font-size: 9pt;
      color: #404040;
      text-align: center;
      line-height: 1.2;
    }
  }
  * { box-sizing: border-box; }
  body {
    font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.15;
    color: #404040;
    margin: 0;
    padding: 0;
    background: #fff;
  }
  .page-break { page-break-after: always; break-after: page; }
  .cover {
    text-align: center;
    min-height: 9in;
    padding-top: 40pt;
  }
  .cover-logo { display: block; width: 301px; height: auto; margin: 0 auto 36pt; }
  .cover-cv { font-size: 18pt; font-weight: bold; color: #000; margin-bottom: 36pt; }
  .cover-name { font-size: 18pt; font-weight: bold; color: #000; margin-bottom: 36pt; text-transform: uppercase; }
  .cover-title { font-size: 18pt; font-weight: bold; color: #000; margin-bottom: 12pt; }
  .cover-tagline { font-size: 18pt; font-weight: bold; color: #000; margin-bottom: 12pt; }
  .body-page { padding-top: 0; }
  .body-header { text-align: center; padding-bottom: 15pt; }
  .body-header-cv { font-size: 11pt; font-weight: bold; color: #000; margin-bottom: 10pt; }
  .body-header-name { font-size: 12pt; font-weight: normal; color: #000; margin-bottom: 10pt; }
  .body-header-title { font-size: 11pt; font-weight: bold; color: #000; }
  .section-title { font-size: 11pt; font-weight: bold; color: #000; margin-top: 12pt; margin-bottom: 7pt; text-transform: uppercase; break-after: avoid; page-break-after: avoid; }
  .details-table { border-collapse: collapse; margin-bottom: 6pt; }
  .details-table td { padding: 0 0 3pt; font-size: 11pt; color: #000; vertical-align: top; }
  .details-table td.dt-label { width: 85pt; }
  .bullets { margin: 0; padding-left: 20pt; text-align: justify; }
  .bullets li { margin-bottom: 4pt; }
  .project-block .bullets li { margin-bottom: 3pt; }
  .skills-table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  .skills-table td { padding: 0 0 4pt; font-size: 11pt; vertical-align: top; }
  .skills-table td.skill-label { width: 130pt; color: #000; white-space: nowrap; padding-right: 15px; }
  .skills-table td.skill-val { color: #000; }
  .project-block { display: flow-root; page-break-inside: avoid; }
  .project-header { display: flex; justify-content: space-between; font-weight: bold; color: #000; margin-top: 10pt; margin-bottom: 2pt; }
  .project-role { font-weight: bold; color: #000; margin-bottom: 3pt; }
  .project-meta { color: #000; margin-bottom: 3pt; }
  .edu-block { margin-bottom: 10pt; page-break-inside: avoid; }
  .edu-header { display: flex; justify-content: space-between; color: #000; margin-bottom: 2pt; }
  .edu-degree { color: #000; }
  .page-footer {
    text-align: center;
    font-size: 9pt;
    color: #404040;
    margin-top: 15pt;
    padding-top: 0;
    border-top: 1px solid #ddd;
  }
  @media print {
    .page-footer { display: none; }
  }
</style>
</head>
<body>
  <div class="cover page-break">
    ${LOGO_B64?`<img class="cover-logo" src="${LOGO_B64}" alt="iGen Logo">`:''}
    <div class="cover-cv">CURRICULUM VITAE</div>
    <div class="cover-name">${esc(d.name)}</div>
    <div class="cover-title">${esc(d.title)}</div>
    ${d.tagline?`<div class="cover-tagline">${esc(d.tagline)}</div>`:''}
  </div>
  <div class="body-page">
    <div class="body-header">
      <div class="body-header-cv">CURRICULUM VITAE</div>
      <div class="body-header-name">${esc(d.name)}</div>
      ${subHead?`<div class="body-header-title">${esc(subHead)}</div>`:''}
    </div>
    ${d.nationality||d.location?`
      <div class="section-title">PERSONAL DETAILS</div>
      <table class="details-table">
        ${d.nationality?`<tr><td class="dt-label">Nationality:</td><td>${esc(d.nationality)}</td></tr>`:''}
        ${d.location?`<tr><td class="dt-label">Lives:</td><td>${esc(d.location)}</td></tr>`:''}
      </table>
    `:''}
    ${profileHtml}
    ${skillsHtml}
    ${projectsHtml}
    ${eduHtml}
  </div>
  <div class="page-footer">
    <div>Page 1 of 1</div>
  </div>
</body>
</html>`;
}

function findBrowser(){
 if(E.BROWSER_BIN&&fs.existsSync(E.BROWSER_BIN))return E.BROWSER_BIN;
 const candidates=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
 ];
 return candidates.find(p=>fs.existsSync(p));
}

function toPdf(dir,htmlPath){
 return new Promise((ok,no)=>{
  if(E.SOFFICE){
   return execFile(E.SOFFICE,['--headless','--convert-to','pdf','--outdir',dir,path.join(dir,'cv.docx')],{timeout:90000},e=>{
    if(!e&&fs.existsSync(path.join(dir,'cv.pdf')))return ok();
    fallbackBrowser(dir,htmlPath,ok,no);
   });
  }
  fallbackBrowser(dir,htmlPath,ok,no);
 });
}

function fallbackBrowser(dir,htmlPath,ok,no){
 const browser=findBrowser();
 if(!browser){
  return execFile('soffice',['--headless','--convert-to','pdf','--outdir',dir,path.join(dir,'cv.docx')],{timeout:90000},e=>{
   if(!e&&fs.existsSync(path.join(dir,'cv.pdf')))return ok();
   no(new Error('PDF generation requires Microsoft Edge, Chrome, or LibreOffice.'));
  });
 }
 const outPdf=path.join(dir,'cv.pdf');
 const userDir=path.join(dir,'edge-prof');
 execFile(browser,[
  '--headless',
  '--disable-gpu',
  '--no-pdf-header-footer',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${userDir}`,
  `--print-to-pdf=${outPdf}`,
  htmlPath
 ],{timeout:30000},err=>{
  if(err||!fs.existsSync(outPdf)){
   no(new Error('PDF generation error: '+(err?err.message:'output missing')));
  } else {
   ok();
  }
 });
}

const purge=id=>{const j=jobs.get(id);if(j){fs.rmSync(j.dir,{recursive:true,force:true});jobs.delete(id)}};
setInterval(()=>{for(const[id,j]of jobs)if(Date.now()>j.exp)purge(id)},30e3).unref();

app.post('/api/convert',up.single('resume'),async(q,r)=>{
 let dir;
 try{
  if(!q.file)throw new Error('No file received.');
  const data=mask(await parse(await extractText(q.file)));
  const id=crypto.randomBytes(16).toString('hex');
  dir=fs.mkdtempSync(path.join(os.tmpdir(),'cv-'));
  
  // 1. Generate DOCX
  fs.writeFileSync(path.join(dir,'cv.docx'),await buildDocx(data));

  // 2. Generate HTML
  const htmlPath=path.join(dir,'cv.html');
  fs.writeFileSync(htmlPath,buildHtml(data),'utf8');

  // 3. Generate PDF
  await toPdf(dir,htmlPath);

  jobs.set(id,{dir,exp:Date.now()+TTL,name:(data.name||'CV').replace(/[^\w]+/g,'_')});
  r.json({id,expiresInMinutes:TTL/60000});
 }catch(e){
  if(dir)fs.rmSync(dir,{recursive:true,force:true});
  r.status(e.statusCode||400).json({error:e.message});
 }
});

app.get('/api/files/:id/:fmt',(q,r)=>{
 const j=jobs.get(q.params.id);if(!j)return r.status(404).json({error:'File expired or not found.'});
 const f=q.params.fmt==='pdf'?'pdf':q.params.fmt==='html'?'html':'docx';
 const filePath=path.join(j.dir,'cv.'+f);
 if(!fs.existsSync(filePath))return r.status(404).json({error:f.toUpperCase()+' file not found.'});
 
 if(f==='pdf'){
  r.type('application/pdf');
  r.setHeader('Content-Disposition',(q.query.inline?'inline':'attachment')+`; filename="iGen_${j.name}_CV.pdf"`);
 } else if(f==='html'){
  r.type('text/html; charset=utf-8');
 } else {
  r.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  r.setHeader('Content-Disposition',`attachment; filename="iGen_${j.name}_CV.docx"`);
 }
 r.setHeader('Cache-Control','no-store');
 r.send(fs.readFileSync(filePath));
});

app.delete('/api/files/:id',(q,r)=>{purge(q.params.id);r.json({ok:true})});

app.use((q,r,n)=>{
 r.setHeader('X-Content-Type-Options','nosniff');
 r.setHeader('Content-Security-Policy',"default-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'");
 n();
});
app.use(express.static(path.join(__dirname,'public')));
app.listen(E.PORT||3000,()=>console.log('Portal on http://localhost:'+(E.PORT||3000)));
