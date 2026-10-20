import { motion } from 'framer-motion';
import { Zap, GitPullRequest, Filter, ListChecks, Sparkles, ClipboardList, Send, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import GraphView from '../components/GraphView';
import { ToneIcon } from '../components/ui/Chip';
import { stagger, rise } from '../components/ui/motion';

const STEPS = [
    { icon: Zap, tone: 'brand', title: 'Trigger', text: 'Every 6 hours, on demand, or within seconds of a GitHub event: a review, a CI result, a push or a comment.' },
    { icon: GitPullRequest, tone: 'info', title: 'Fetch', text: 'One GitHub GraphQL query reads every open PR with its reviews, threads, CI status, conflicts and requested reviewers.' },
    { icon: Filter, tone: 'info', title: 'Filter & cache', text: 'Bots and ignored labels are skipped. PRs that have not changed since the last scan reuse their result, with no AI call.' },
    { icon: ListChecks, tone: 'ready', title: 'Rules first', text: 'Certain states are decided by plain code, in parallel: draft, CI failing, conflict, changes requested, ready to merge.' },
    { icon: Sparkles, tone: 'brand', title: 'AI only when unsure', text: 'Groq gpt-oss-120b reads the conversation to answer "was the feedback addressed?" and "whose turn is it?". It never sees the code.' },
    { icon: ClipboardList, tone: 'author', title: 'Plan', text: 'Notifies only when a PR changes state or a reminder is due, respects quiet hours, and holds escalations for your approval.' },
    { icon: Send, tone: 'review', title: 'Act', text: 'Edits one PR Sentinel comment per PR, sets a sentinel:* label and sends one Slack digest grouped by person.' },
    { icon: ShieldCheck, tone: 'ready', title: 'Safe by default', text: 'Dry run until you switch it off. The AI only decides; one tested step does all the posting.' },
];

export default function Workflow() {
    return (
        <>
            <PageHeader eyebrow="Under the hood" title="How PR Sentinel works"
                subtitle="A LangGraph flow that decides with rules first, asks the AI only when it has to, and acts in one place." />
            <motion.div className="grid grid-4" variants={stagger(0.05)} initial="hidden" animate="show" style={{ marginBottom: 20 }}>
                {STEPS.map((s, i) => (
                    <motion.div key={s.title} variants={rise} className="card card-pad col" style={{ gap: 10 }}>
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                            <ToneIcon tone={s.tone} icon={s.icon} />
                            <span className="mono faint" style={{ fontSize: 12 }}>{String(i + 1).padStart(2, '0')}</span>
                        </div>
                        <div style={{ fontWeight: 600 }}>{s.title}</div>
                        <p className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>{s.text}</p>
                    </motion.div>
                ))}
            </motion.div>
            <GraphView />
        </>
    );
}
