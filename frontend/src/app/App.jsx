import { Component, Suspense, lazy } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { LoginPage } from '../features/auth/LoginPage';
import { WorkspaceProvider, useWorkspace } from './WorkspaceProvider';
import { AppShell } from '../components/AppShell';
import { Empty } from '../components/ui';
import { AI_ENABLED } from '../services/gateway';
const page = (path, name) => lazy(() => path().then(module => ({ default: module[name] })));
const Dashboard = page(() => import('../features/dashboard/DashboardPage'), 'DashboardPage');
const Worklist = page(() => import('../features/worklist/WorklistPage'), 'WorklistPage');
const Loans = page(() => import('../features/loans/LoansPage'), 'LoansPage');
const LoanDetail = page(() => import('../features/loans/LoanDetailPage'), 'LoanDetailPage');
const Contacts = page(() => import('../features/contacts/ContactsPage'), 'ContactsPage');
const Settlements = page(() => import('../features/settlements/SettlementsPage'), 'SettlementsPage');
const Reconciliation = page(() => import('../features/reconciliation/ReconciliationPage'), 'ReconciliationPage');
const DayEnd = page(() => import('../features/day-end/DayEndPage'), 'DayEndPage');
const Imports = page(() => import('../features/imports/ImportsPage'), 'ImportsPage');
const Exports = page(() => import('../features/exports/ExportsPage'), 'ExportsPage');
const Rules = page(() => import('../features/rules/RulesPage'), 'RulesPage');
const Audit = page(() => import('../features/audit/AuditPage'), 'AuditPage');
const Insights = page(() => import('../features/ai/InsightsPage'), 'InsightsPage');
function Loading() { return <div className="loading-state" role="status"><span className="loading-spinner"/>Loading your workspace…</div>; }
class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <Empty title="This view could not be loaded" text="Reload the workspace to try again."><button className="button primary" onClick={() => window.location.reload()}>Reload workspace</button></Empty> : this.props.children; }
}
function WorkspaceRoutes() {
  const {data,loading,error,refresh}=useWorkspace();
  if (!data && loading) return <Loading/>;
  if (error && !data) return <Empty title="Unable to load the workspace" text={error}><button className="button primary" onClick={()=>void refresh()}>Try again</button></Empty>;
  return <ErrorBoundary><Suspense fallback={<Loading/>}><Routes><Route element={<AppShell/>}>
    <Route index element={<Dashboard/>}/><Route path="worklist" element={<Worklist/>}/><Route path="loans" element={<Loans/>}/><Route path="loans/:id" element={<LoanDetail/>}/>
    <Route path="contacts" element={<Contacts/>}/><Route path="settlements" element={<Settlements/>}/><Route path="reconciliation" element={<Reconciliation/>}/>
    <Route path="day-end" element={<DayEnd/>}/><Route path="imports" element={<Imports/>}/><Route path="exports" element={<Exports/>}/><Route path="rules" element={<Rules/>}/><Route path="audit" element={<Audit/>}/>
    <Route path="insights" element={AI_ENABLED?<Insights/>:<Navigate to="/" replace/>}/>
    <Route path="*" element={<Empty title="This page isn’t here" text="Head back to the overview to keep going."><Link className="button primary" to="/">Back to overview</Link></Empty>}/>
  </Route></Routes></Suspense></ErrorBoundary>;
}
function AuthenticatedApp() {
  const {session,ready}=useAuth();
  if(!ready)return <Loading/>;
  if(!session)return <LoginPage/>;
  return <WorkspaceProvider><a className="skip-link" href="#main-content">Skip to main content</a><WorkspaceRoutes/></WorkspaceProvider>;
}
export function App() { return <AuthProvider><AuthenticatedApp/></AuthProvider>; }
