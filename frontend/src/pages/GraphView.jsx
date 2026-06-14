import React from 'react';
import { useOutletContext } from 'react-router-dom';
import DependencyGraph from '../components/Github/DependencyGraph';
import ImpactPanel from '../components/Github/ImpactPanel';

const GraphView = () => {
  const {
    graphData, repoUrl, loading,
    impactOpen, setImpactOpen,
    onNodeSelect, nodeReviews, onMultiSelectChange,
  } = useOutletContext();

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {graphData && (
        <ImpactPanel
          graph={{ nodes: graphData.nodes, edges: graphData.links || graphData.edges || [] }}
          isOpen={impactOpen}
          onClose={() => setImpactOpen(false)}
        />
      )}
      {graphData ? (
        <DependencyGraph
          data={graphData}
          repoUrl={repoUrl}
          onNodeSelect={onNodeSelect}
          nodeReviews={nodeReviews}
          onMultiSelectChange={onMultiSelectChange}
        />
      ) : !loading ? (
        <div className="analyzer-empty">
          <span className="analyzer-empty-icon">⬡</span>
          <p>Paste a GitHub URL above and press Analyze</p>
          <small>Supports https://github.com/… · git@github.com:… · owner/repo</small>
        </div>
      ) : (
        <div className="analyzer-empty">
          <div className="analyzer-pulse" />
          <p>Fetching repository···</p>
        </div>
      )}
    </div>
  );
};

export default GraphView;
