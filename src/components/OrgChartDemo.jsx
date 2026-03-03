import React, { useEffect, useState } from 'react';
import { generateEdges } from '../utils/generateEdges';

// Configuration du spacing
const SPACING_X = 60; // Demi-largeur d'un nœud
const SPACING_Y = 40; // Demi-hauteur d'un nœud
const NODE_WIDTH = 120;
const NODE_HEIGHT = 40;

// Utilitaire : convertir des contacts réels en nodes pour le positionnement
function convertContactsToNodes(contacts) {
  if (!contacts || contacts.length === 0) return [];
  
  return contacts.map(c => ({
    id: c.id,
    name: c.firstName && c.lastName ? `${c.firstName} ${c.lastName}` : (c.position || 'Contact'),
    parentId: c.managerId || null,
  }));
}

// Petit composant de démonstration SVG qui utilise l'IA de positionnement
export default function OrgChartDemo({ selectedOrgChart = null, allContacts = [] }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  useEffect(() => {
    async function loadPositions() {
      // Déterminer la source de données:
      // 1. Si selectedOrgChart existe, utiliser ses contacts
      // 2. Sinon, utiliser allContacts
      // 3. En dernier recours, utiliser un sample pour la démo
      let nodeData = [];
      if (selectedOrgChart && selectedOrgChart.contacts && selectedOrgChart.contacts.length > 0) {
        nodeData = convertContactsToNodes(selectedOrgChart.contacts);
      } else if (allContacts && allContacts.length > 0) {
        nodeData = convertContactsToNodes(allContacts);
      } else {
        // Sample pour la démo si aucune donnée réelle
        nodeData = [
          { id: '1', name: 'CEO' },
          { id: '2', name: 'CTO', parentId: '1' },
          { id: '3', name: 'CFO', parentId: '1' },
          { id: '4', name: 'Dev A', parentId: '2' },
          { id: '5', name: 'Dev B', parentId: '2' },
          { id: '6', name: 'Acct', parentId: '3' }
        ];
      }

      let positioned = [];
      try {
        if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.placerOrganigramme === 'function') {
          positioned = await window.electronAPI.placerOrganigramme(nodeData);
        } else {
          // fallback to local module (useful for dev without Electron)
          // eslint-disable-next-line global-require
          const placer = require('../modules/iaPlacementOrganigramme');
          positioned = placer.placerOrganigramme(nodeData);
        }
      } catch (e) {
        // fallback: use sample as-is with default grid positions
        positioned = nodeData.map((n, i) => ({ 
          ...n, 
          x: (i % 4) * (NODE_WIDTH + 40), 
          y: Math.floor(i / 4) * (NODE_HEIGHT + 60) 
        }));
      }

      setNodes(positioned);
      setEdges(generateEdges(positioned));
    }

    loadPositions();
  }, [selectedOrgChart, allContacts]);

  // Compute bounds and svg size
  const padding = 40;
  if (nodes.length === 0) {
    return (
      <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 8, background: '#f9f9f9', width: '100%', boxSizing: 'border-box' }}>
        <h4 style={{ margin: '6px 0', color: '#666' }}>IA Placement Preview</h4>
        <p style={{ fontSize: 12, color: '#999', margin: 4 }}>Aucune donnée à afficher</p>
      </div>
    );
  }

  const minX = Math.min(...nodes.map(n => n.x || 0)) - SPACING_X - padding;
  const minY = Math.min(...nodes.map(n => n.y || 0)) - SPACING_Y - padding;
  const maxX = Math.max(...nodes.map(n => n.x || 0)) + SPACING_X + padding;
  const maxY = Math.max(...nodes.map(n => n.y || 0)) + SPACING_Y + padding;
  const width = Math.ceil(maxX - minX);
  const height = Math.ceil(maxY - minY);

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: 8, background: '#fff', width: '100%', boxSizing: 'border-box' }}>
      <h4 style={{ margin: '6px 0', fontSize: 14, fontWeight: 600 }}>
        IA Placement Preview
        {selectedOrgChart?.name ? ` - ${selectedOrgChart.name}` : ' (Demo)'}
      </h4>
      <p style={{ fontSize: 11, color: '#999', margin: '4px 0 8px 0' }}>
        {nodes.length} nœud{nodes.length > 1 ? 's' : ''} · {edges.length} lien{edges.length > 1 ? 's' : ''}
      </p>
      
      <svg 
        width="100%" 
        viewBox={`${minX} ${minY} ${width} ${height}`} 
        style={{ 
          display: 'block', 
          border: '1px solid #eee',
          borderRadius: 4,
          background: '#fafafa'
        }}
      >
        {/* Grille de fond (optionnel) */}
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#f0f0f0" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#grid)" />

        {/* ÉTAPE 1: Dessiner les EDGES en premier (aparaissent en arrière) */}
        {edges.length > 0 && (
          <g stroke="#999" strokeWidth="1.5" fill="none">
            {edges.map((edge) => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              
              if (!fromNode || !toNode) return null;
              
              // Coordonnées : bas du nœud parent vers haut du nœud enfant
              const x1 = fromNode.x;
              const y1 = (fromNode.y || 0) + SPACING_Y;
              const x2 = toNode.x;
              const y2 = (toNode.y || 0) - SPACING_Y;
              
              // Chemin vertical-horizontal-vertical pour une meilleure lisibilité
              const midY = (y1 + y2) / 2;
              
              return (
                <path
                  key={`edge-${edge.from}-${edge.to}`}
                  d={`M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
          </g>
        )}

        {/* ÉTAPE 2: Dessiner les NODES (aparaissent au-dessus) */}
        {nodes.map((node) => {
          const x = node.x || 0;
          const y = node.y || 0;
          const isRoot = !node.parentId;
          
          return (
            <g key={`node-${node.id}`}>
              {/* Rectangle du nœud */}
              <rect
                x={x - SPACING_X}
                y={y - SPACING_Y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={6}
                ry={6}
                fill={isRoot ? '#e3f2fd' : '#f6f8fa'}
                stroke={isRoot ? '#1976d2' : '#2f80ed'}
                strokeWidth={isRoot ? 2 : 1}
              />
              
              {/* Texte du nœud */}
              <text
                x={x}
                y={y + 4}
                fontSize={11}
                fontWeight={isRoot ? 600 : 400}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#111"
                style={{ pointerEvents: 'none' }}
              >
                {(node.name || node.id).length > 18 
                  ? `${(node.name || node.id).substring(0, 15)}...` 
                  : (node.name || node.id)}
              </text>
            </g>
          );
        })}
      </svg>
      
      <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
        Dimensions: {width.toFixed(0)} × {height.toFixed(0)}px
      </div>
    </div>
  );
}
