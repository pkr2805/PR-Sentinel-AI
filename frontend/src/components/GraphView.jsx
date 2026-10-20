import { memo } from 'react';
import ReactFlow, { Background, Controls, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import { Zap, GitPullRequest, Filter, ListChecks, Sparkles, ClipboardList, ShieldAlert, Send, Database } from 'lucide-react';

const FlowNode = memo(({ data }) => (
    <div className="flow-node" data-tone={data.tone}>
        <Handle type="target" position={Position.Top} />
        <span className="tone-icon" data-tone={data.tone}><data.icon size={16} /></span>
        <div className="col">
            <span style={{ fontWeight: 600, fontSize: 13 }}>{data.label}</span>
            <span className="muted" style={{ fontSize: 11.5 }}>{data.subtitle}</span>
        </div>
        <Handle type="source" position={Position.Bottom} />
    </div>
));
FlowNode.displayName = 'FlowNode';

const nodeTypes = { sentinel: FlowNode };

const node = (id, x, y, label, subtitle, icon, tone) => ({ id, type: 'sentinel', position: { x, y }, data: { label, subtitle, icon, tone } });

const NODES = [
    node('trigger', 250, 0, 'Trigger', 'Schedule · webhook · manual', Zap, 'brand'),
    node('fetch', 250, 105, 'Fetch open PRs', 'One GraphQL query', GitPullRequest, 'info'),
    node('filter', 250, 210, 'Filter + cache', 'Skip bots · reuse unchanged', Filter, 'info'),
    node('rules', 40, 330, 'Rule classifier', 'Certain states · in parallel', ListChecks, 'ready'),
    node('llm', 460, 330, 'AI judge', 'Groq gpt-oss-120b + MCP', Sparkles, 'brand'),
    node('plan', 250, 450, 'Plan actions', 'Dedupe · reminders · quiet hours', ClipboardList, 'author'),
    node('approval', 480, 565, 'Approval gate', 'Escalations wait for you', ShieldAlert, 'danger'),
    node('act', 250, 680, 'Act', 'Comment · labels · Slack digest', Send, 'review'),
    node('save', 250, 790, 'Save memory', 'State · notified · metrics', Database, 'neutral'),
];

const edge = (id, source, target, extra = {}) => ({ id, source, target, type: 'smoothstep', ...extra });

const EDGES = [
    edge('e1', 'trigger', 'fetch', { animated: true }),
    edge('e2', 'fetch', 'filter', { animated: true }),
    edge('e3', 'filter', 'rules', { animated: true }),
    edge('e4', 'rules', 'llm', { label: 'only if unsure', animated: true }),
    edge('e5', 'rules', 'plan'),
    edge('e6', 'llm', 'plan'),
    edge('e7', 'plan', 'approval', { label: 'escalation' }),
    edge('e8', 'plan', 'act', { animated: true }),
    edge('e9', 'approval', 'act'),
    edge('e10', 'act', 'save', { animated: true }),
];

export default function GraphView() {
    return (
        <div className="flow-wrap card">
            <ReactFlow nodes={NODES} edges={EDGES} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.15 }}
                nodesConnectable={false} proOptions={{ hideAttribution: true }} minZoom={0.4} maxZoom={1.6}>
                <Background gap={22} size={1} color="var(--border-strong)" />
                <Controls showInteractive={false} />
            </ReactFlow>
        </div>
    );
}
