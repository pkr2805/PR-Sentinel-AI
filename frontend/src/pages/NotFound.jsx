import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';

export default function NotFound() {
    return (
        <div className="card">
            <EmptyState icon={Compass} title="This page doesn't exist" action={<Link to="/" className="btn btn-secondary">Go to overview</Link>}>
                The link may be old. Press ⌘K to search for what you need.
            </EmptyState>
        </div>
    );
}
