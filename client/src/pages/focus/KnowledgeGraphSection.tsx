/**
 * 知识图谱区块
 *
 * 使用简化的力导向布局（纯 JS，无 D3 依赖）。
 * 节点 = 知识点（大小=掌握度，颜色=领域，红色边框=薄弱）
 * 连线 = 逻辑关系（实线=父子，虚线=关联）
 */

import { useEffect, useRef, useState } from "react";
import { useFocusStore, type GraphNode, type GraphEdge } from "@/stores/focusStore";

// ── 简易力导向布局 ──

interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function runForceSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
): LayoutNode[] {
  const layoutNodes: LayoutNode[] = nodes.map((n) => ({
    ...n,
    x: width / 2 + (Math.random() - 0.5) * 100,
    y: height / 2 + (Math.random() - 0.5) * 100,
    vx: 0,
    vy: 0,
  }));

  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

  // 模拟 80 步
  for (let step = 0; step < 80; step++) {
    const alpha = 1 - step / 80;

    // 排斥力（节点之间）
    for (let i = 0; i < layoutNodes.length; i++) {
      for (let j = i + 1; j < layoutNodes.length; j++) {
        const a = layoutNodes[i];
        const b = layoutNodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (80 * 80) / dist * alpha * 0.5;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // 吸引力（边）
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;
      let dx = target.x - source.x;
      let dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 60) * edge.strength * alpha * 0.3;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }

    // 中心引力
    for (const n of layoutNodes) {
      n.vx += (width / 2 - n.x) * 0.001 * alpha;
      n.vy += (height / 2 - n.y) * 0.001 * alpha;
    }

    // 更新位置
    for (const n of layoutNodes) {
      n.vx *= 0.6; // 阻尼
      n.vy *= 0.6;
      n.x += n.vx;
      n.y += n.vy;
      // 边界约束
      n.x = Math.max(20, Math.min(width - 20, n.x));
      n.y = Math.max(20, Math.min(height - 20, n.y));
    }
  }

  return layoutNodes;
}

// ── 状态颜色映射 ──

function statusStroke(status: string): string {
  switch (status) {
    case "weak": return "#FF3B30";
    case "mastered": return "#34C759";
    default: return "transparent";
  }
}

// ── 组件 ──

export function KnowledgeGraphSection() {
  const graphNodes = useFocusStore((s) => s.graphNodes);
  const graphEdges = useFocusStore((s) => s.graphEdges);
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgSize] = useState({ width: 350, height: 300 });

  useEffect(() => {
    if (graphNodes.length > 0) {
      // 限制节点数量（性能）
      const displayNodes = graphNodes.slice(0, 80);
      const displayEdges = graphEdges.filter(
        (e) => displayNodes.find((n) => n.id === e.source) && displayNodes.find((n) => n.id === e.target)
      );
      const layout = runForceSimulation(displayNodes, displayEdges, svgSize.width, svgSize.height);
      setLayoutNodes(layout);
    }
  }, [graphNodes, graphEdges, svgSize.width, svgSize.height]);

  const selected = layoutNodes.find((n) => n.id === selectedNode);
  const connectedIds = new Set(
    selectedNode
      ? graphEdges
          .filter((e) => e.source === selectedNode || e.target === selectedNode)
          .flatMap((e) => [e.source, e.target])
      : []
  );

  if (graphNodes.length === 0) {
    return (
      <div className="bg-white rounded-card shadow-card px-5 py-6 mb-6">
        <h3 className="text-section-title text-text-primary mb-3">🧠 知识图谱</h3>
        <p className="text-caption text-text-tertiary text-center py-4">
          导入知识后将自动生成知识关联图谱
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-card shadow-card px-4 py-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-section-title text-text-primary">🧠 知识图谱</h3>
        <span className="text-caption text-text-tertiary">
          {graphNodes.length} 节点
        </span>
      </div>

      {/* SVG 画布 */}
      <div className="relative bg-gray-50 rounded-tag overflow-hidden" style={{ height: svgSize.height }}>
        <svg
          ref={svgRef}
          width={svgSize.width}
          height={svgSize.height}
          className="w-full"
        >
          {/* 边 */}
          {graphEdges.slice(0, 200).map((edge, i) => {
            const source = layoutNodes.find((n) => n.id === edge.source);
            const target = layoutNodes.find((n) => n.id === edge.target);
            if (!source || !target) return null;
            const isHighlighted = selectedNode && (edge.source === selectedNode || edge.target === selectedNode);
            return (
              <line
                key={i}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={isHighlighted ? "#0071E3" : "#E5E5EA"}
                strokeWidth={isHighlighted ? 2 : 0.8}
                strokeDasharray={edge.type === "parent_child" ? undefined : "4,3"}
                opacity={selectedNode && !isHighlighted ? 0.15 : 0.6}
              />
            );
          })}

          {/* 节点 */}
          {layoutNodes.map((node) => {
            const isSelected = node.id === selectedNode;
            const isConnected = connectedIds.has(node.id);
            const opacity = selectedNode && !isSelected && !isConnected ? 0.3 : 1;
            return (
              <g
                key={node.id}
                onClick={() => setSelectedNode(isSelected ? null : node.id)}
                className="cursor-pointer"
                opacity={opacity}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={Math.max(4, node.size / 2)}
                  fill={node.color}
                  stroke={statusStroke(node.status)}
                  strokeWidth={node.status === "weak" ? 2.5 : 1}
                />
                {node.size >= 14 && (
                  <text
                    x={node.x}
                    y={node.y + node.size / 2 + 10}
                    textAnchor="middle"
                    className="text-label select-none"
                    fill="#6E6E73"
                    fontSize={9}
                  >
                    {node.label.slice(0, 6)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 选中节点详情 */}
      {selected && (
        <div className="mt-3 px-3 py-2 bg-blue-50 rounded-tag">
          <p className="text-body text-text-primary font-medium">{selected.label}</p>
          <p className="text-caption text-text-secondary">
            掌握度：{selected.status === "mastered" ? "已掌握" : selected.status === "weak" ? "薄弱" : "学习中"}
          </p>
        </div>
      )}

      <p className="text-label text-text-tertiary text-center mt-2 select-none">
        点击节点查看详情 · 红色边框 = 薄弱 · 绿色边框 = 已掌握
      </p>
    </div>
  );
}
