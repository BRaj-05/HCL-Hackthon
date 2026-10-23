import { Link } from 'react-router-dom';
import { initials } from '../lib/format';
export function AccountLabel({ loan, compact = false }) {
    return <Link className="account-label" to={'/loans/' + encodeURIComponent(loan.id)}>{!compact && <span className="avatar">{initials(loan.borrower)}</span>}<span><strong>{loan.borrower}</strong><small>{loan.id}{!compact && ' · ' + loan.product}</small></span></Link>;
}
