import { useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Download, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../app/WorkspaceProvider';
import { useAuth } from '../auth/AuthProvider';
import { gateway } from '../../services/gateway';
import { can } from '../../lib/permissions';
import { csvColumns, download, parseCsv, template } from '../../lib/csv';
import { errorMessage, timestamp } from '../../lib/format';
import { Empty, Notice, PageHeader, Panel, Table } from '../../components/ui';
export function ImportsPage() {
  const {data,act,busy}=useWorkspace();const {session}=useAuth();const [kind,setKind]=useState('loans');const [rows,setRows]=useState([]);const [fileName,setFileName]=useState('');const [error,setError]=useState('');const [parsing,setParsing]=useState(false);const [inputKey,setInputKey]=useState(0);const generation=useRef(0);
  if(!data)return null;const allowed=can(session.user,'data:import');
  const readFile=async file=>{const current=++generation.current;setRows([]);setError('');setFileName(file?.name??'');if(!file)return;if(!file.name.toLowerCase().endsWith('.csv')){setError('Choose a .csv file.');return;}if(file.size>5*1024*1024){setError('File is too large. Maximum size is 5 MB.');return;}setParsing(true);try{const parsed=parseCsv(await file.text(),kind);if(current===generation.current)setRows(parsed);}catch(err){if(current===generation.current)setError(errorMessage(err));}finally{if(current===generation.current)setParsing(false);}};
  const clear=()=>{generation.current++;setRows([]);setFileName('');setError('');setParsing(false);setInputKey(k=>k+1);};
  return <><PageHeader eyebrow="GOOD DATA. A BETTER START." title="Import data" description="Bring loan, schedule, payment and contact records into one workspace."><Link className="button secondary" to="/day-end">Go to day-end<ArrowRight size={16}/></Link></PageHeader>
    <Notice>Import in order: loans → schedules → payments → contacts. Existing IDs or payment references are rejected to prevent duplicate records. Run day-end after importing to update account positions.</Notice>
    {!allowed&&<Notice tone="warning">Your role can view import history. A manager or collections head must import data.</Notice>}
    <Panel title="Upload a CSV" subtitle="Validate the columns and preview records before importing"><div className="import-body"><div className="import-kind-grid">{Object.keys(csvColumns).map((k,i)=><button disabled={busy||!allowed} key={k} className={kind===k?'selected':''} onClick={()=>{setKind(k);clear();}}><span>0{i+1}</span><FileSpreadsheet size={20}/><strong>{k[0].toUpperCase()+k.slice(1)}</strong></button>)}</div><div className="import-template"><div><strong>Use the {kind} template</strong><p>Required columns: <span className="monospace">{csvColumns[kind].join(', ')}</span></p></div><button className="button secondary small" onClick={()=>download(template(kind),kind+'-template.csv')}><Download size={14}/>Download template</button></div>
    <label className={'upload-zone '+(!allowed?'disabled':'')}><UploadCloud size={32} strokeWidth={1.4}/><strong>{parsing?'Validating CSV…':fileName||'Choose a CSV to get started'}</strong><span>Click to browse · UTF-8 CSV · Up to 5 MB / 10,000 rows</span><input key={inputKey} aria-label="Upload CSV file" type="file" accept=".csv,text/csv" disabled={!allowed||busy} onChange={e=>void readFile(e.target.files?.[0])}/></label>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {rows.length>0&&<><div className="preview-header"><span><CheckCircle2 size={17}/>{rows.length} rows pass CSV validation</span><small>Showing the first 5 rows. References and duplicates are checked on import.</small></div><Table headers={csvColumns[kind]}>{rows.slice(0,5).map(row=><tr key={row.id}>{csvColumns[kind].map(column=><td key={column}>{row[column]||'—'}</td>)}</tr>)}</Table><div className="import-submit"><button className="button secondary" disabled={busy} onClick={clear}>Clear selection</button><button className="button primary" disabled={busy||!allowed} onClick={async()=>{if(await act(()=>gateway.importRows(session.user,kind,rows,fileName),'CSV imported. Run day-end to refresh positions.'))clear();}}>{busy?'Importing…':'Import '+rows.length+' records'}<ArrowRight size={15}/></button></div></>}
    </div></Panel>
    <Panel className="spaced" title="Import history" subtitle="A traceable record of data added to this workspace">{data.imports.length?<Table headers={['File','Type','Rows','Imported by','Imported (IST)']}>{data.imports.map(i=><tr key={i.id}><td className="strong">{i.fileName}</td><td className="capitalize">{i.kind}</td><td>{i.rows}</td><td>{i.actor}</td><td>{timestamp(i.createdAt)}</td></tr>)}</Table>:<Empty title="No imports yet" text="Your CSV import history will appear here."/>}</Panel></>;
}
