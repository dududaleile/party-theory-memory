export interface KnowledgeDomain {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
  order: number;
  color: string | null;
  icon: string | null;
  totalPoints: number;
  masteredPoints: number;
  createdAt: number;
  updatedAt: number;
}

export interface DomainTreeNode {
  domain: KnowledgeDomain;
  children: DomainTreeNode[];
  depth: number;
  mastery: {
    total: number;
    mastered: number;
    percentage: number;
  };
}
