import { useCallback, memo } from 'react';
import ReactFlow, {
    Background, Controls, MiniMap,
    addEdge, useNodesState, useEdgesState,
    Handle, Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Text, Icon, Badge } from '@chakra-ui/react';
import { Zap, GitPullRequest, Cpu, Send, AlertTriangle, Database, CheckCircle, XCircle } from 'lucide-react';

const NODE_STYLES = {
    trigger: { bg: '#1a3a6b', border: '#2b72e8', icon: Zap, color: '#4a90f5' },
    fetch: { bg: '#1a3a4a', border: '#0ea5e9', icon: GitPullRequest, color: '#38bdf8' },
    jira: { bg: '#2d2060', border: '#7c3aed', icon: Database, color: '#a78bfa' },
    llm: { bg: '#1a3a6b', border: '#2b72e8', icon: Cpu, color: '#60a5fa' },
    merge: { bg: '#1a4a2a', border: '#16a34a', icon: CheckCircle, color: '#4ade80' },
    ping: { bg: '#3a3010', border: '#ca8a04', icon: Send, color: '#fbbf24' },
    escalate: { bg: '#4a1010', border: '#dc2626', icon: AlertTriangle, color: '#f87171' },
    ignore: { bg: '#1e2430', border: '#4b5563', icon: XCircle, color: '#9ca3af' },
    slack: { bg: '#1a3a2a', border: '#059669', icon: Send, color: '#34d399' },
    persist: { bg: '#2a1a3a', border: '#9333ea', icon: Database, color: '#c084fc' },
};

const AgentNode = memo(({ data }) => {
    const style = NODE_STYLES[data.type] || NODE_STYLES.fetch;
    const IconComp = style.icon;

    return (
        <Box
            bg={style.bg}
            border="1.5px solid"
            borderColor={style.border}
            borderRadius="10px"
            px={3}
            py={2.5}
            minW="140px"
            boxShadow={`0 0 12px ${style.border}44`}
            position="relative"
        >
            <Handle type="target" position={Position.Top} style={{ background: style.border, border: 'none', width: 8, height: 8 }} />
            <Box display="flex" alignItems="center" gap={2}>
                <Box
                    w={7} h={7} borderRadius="8px"
                    bg={`${style.border}22`}
                    display="flex" alignItems="center" justifyContent="center"
                    flexShrink={0}
                >
                    <IconComp size={14} color={style.color} />
                </Box>
                <Box>
                    <Text fontSize="11px" fontWeight="700" color="white" lineHeight="1.3">{data.label}</Text>
                    {data.subtitle && <Text fontSize="9px" color="gray.400" mt={0.5}>{data.subtitle}</Text>}
                </Box>
            </Box>
            <Handle type="source" position={Position.Bottom} style={{ background: style.border, border: 'none', width: 8, height: 8 }} />
        </Box>
    );
});

const nodeTypes = { agentNode: AgentNode };

const INITIAL_NODES = [
    { id: 'trigger', type: 'agentNode', position: { x: 250, y: 0 }, data: { label: 'Scheduler Trigger', subtitle: 'APScheduler · per repo', type: 'trigger' } },
    { id: 'fetch', type: 'agentNode', position: { x: 250, y: 100 }, data: { label: 'Fetch Open PRs', subtitle: 'GitHub API', type: 'fetch' } },
    { id: 'jira', type: 'agentNode', position: { x: 250, y: 200 }, data: { label: 'Jira Status', subtitle: 'Correlate tickets', type: 'jira' } },
    { id: 'llm', type: 'agentNode', position: { x: 250, y: 300 }, data: { label: 'LLM Decision', subtitle: 'Groq · gpt-oss-120b', type: 'llm' } },
    { id: 'merge', type: 'agentNode', position: { x: 0, y: 430 }, data: { label: 'Ask to Merge', subtitle: 'Jira Done + stale', type: 'merge' } },
    { id: 'ping', type: 'agentNode', position: { x: 160, y: 430 }, data: { label: 'Ping Reviewer', subtitle: 'Inactive PR', type: 'ping' } },
    { id: 'escalate', type: 'agentNode', position: { x: 330, y: 430 }, data: { label: 'Escalate', subtitle: 'Threshold breached', type: 'escalate' } },
    { id: 'ignore', type: 'agentNode', position: { x: 490, y: 430 }, data: { label: 'Ignore', subtitle: 'No action needed', type: 'ignore' } },
    { id: 'slack', type: 'agentNode', position: { x: 250, y: 560 }, data: { label: 'Slack Notification', subtitle: 'Digest + escalation', type: 'slack' } },
    { id: 'persist', type: 'agentNode', position: { x: 250, y: 660 }, data: { label: 'Persist to DB', subtitle: 'Audit log + state', type: 'persist' } },
];

const edgeStyle = { stroke: '#30363D', strokeWidth: 1.5 };
const INITIAL_EDGES = [
    { id: 'e1', source: 'trigger', target: 'fetch', animated: true, style: { stroke: '#2b72e8', strokeWidth: 1.5 } },
    { id: 'e2', source: 'fetch', target: 'jira', animated: true, style: { stroke: '#2b72e8', strokeWidth: 1.5 } },
    { id: 'e3', source: 'jira', target: 'llm', animated: true, style: { stroke: '#2b72e8', strokeWidth: 1.5 } },
    { id: 'e4', source: 'llm', target: 'merge', style: { stroke: '#16a34a', strokeWidth: 1.5 } },
    { id: 'e5', source: 'llm', target: 'ping', style: { stroke: '#ca8a04', strokeWidth: 1.5 } },
    { id: 'e6', source: 'llm', target: 'escalate', style: { stroke: '#dc2626', strokeWidth: 1.5 } },
    { id: 'e7', source: 'llm', target: 'ignore', style: edgeStyle },
    { id: 'e8', source: 'merge', target: 'slack', style: edgeStyle },
    { id: 'e9', source: 'ping', target: 'slack', style: edgeStyle },
    { id: 'e10', source: 'escalate', target: 'slack', style: edgeStyle },
    { id: 'e11', source: 'slack', target: 'persist', animated: true, style: { stroke: '#9333ea', strokeWidth: 1.5 } },
];

export default function GraphView({ height = '600px' }) {
    const [nodes, , onNodesChange] = useNodesState(INITIAL_NODES);
    const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);

    const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    return (
        <Box h={height} w="100%" borderRadius="12px" overflow="hidden" border="1px solid" borderColor="surface.border">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                attributionPosition="bottom-left"
            >
                <Background color="#21262D" gap={24} />
                <Controls style={{ background: '#161B22', border: '1px solid #21262D' }} />
                <MiniMap
                    style={{ background: '#0D1117', border: '1px solid #21262D' }}
                    nodeColor={(n) => NODE_STYLES[n.data?.type]?.border || '#21262D'}
                />
            </ReactFlow>
        </Box>
    );
}
