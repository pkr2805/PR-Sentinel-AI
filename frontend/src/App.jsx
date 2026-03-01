import { Routes, Route } from 'react-router-dom';
import { Flex, Box } from '@chakra-ui/react';
import Sidebar from './layout/Sidebar';
import Topbar from './layout/Topbar';
import Dashboard from './pages/Dashboard';
import PRExplorer from './pages/PRExplorer';
import PRDetail from './pages/PRDetail';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import { useState, useEffect } from 'react';
import { getRepos } from './services/api';

export default function App() {
  const [repos, setRepos] = useState([]);
  const [repoId, setRepoId] = useState(null);

  useEffect(() => { getRepos().then(setRepos); }, []);

  return (
    <Flex h="100vh" overflow="hidden">
      <Sidebar />
      <Flex flex={1} flexDir="column" overflow="hidden">
        <Topbar repos={repos} selectedRepoId={repoId} onRepoChange={setRepoId} />
        <Box flex={1} overflow="auto" p={6} className="fade-in">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/prs" element={<PRExplorer />} />
            <Route path="/prs/:id" element={<PRDetail />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/repos" element={<Settings />} />
          </Routes>
        </Box>
      </Flex>
    </Flex>
  );
}
