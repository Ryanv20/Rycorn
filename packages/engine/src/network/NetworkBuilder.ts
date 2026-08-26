import { Port } from '../domain/ports/Port';
import { NetworkNode } from '../domain/network/NetworkNode';
import { NetworkEdge, EdgeId } from '../domain/network/NetworkEdge';
import { MaritimeNetwork } from '../domain/network/MaritimeNetwork';
import { VesselCapability } from '../domain/network/VesselCapability';
import { IntermediateNodeGenerator } from './IntermediateNodeGenerator';
import { NodeId } from '../domain/nodes/GeographicNode';

export interface EdgeDefinition {
  fromPortId: string;
  toPortId: string;
  minimumCapability: VesselCapability;
}

export class NetworkBuilder {
  private nodes = new Map<NodeId, NetworkNode>();
  private edges = new Map<EdgeId, NetworkEdge>();
  private adjacency = new Map<NodeId, EdgeId[]>();
  private intermediateCount = 0;

  addPorts(ports: Port[]) {
    for (const port of ports) {
      const nodeId = `node-${port.id}` as NodeId;
      this.nodes.set(nodeId, {
        id: nodeId,
        type: 'PORT',
        position: port.position,
        portId: port.id
      });
    }
  }

  addEdges(definitions: EdgeDefinition[]) {
    for (const def of definitions) {
      const fromNodeId = `node-${def.fromPortId}` as NodeId;
      const toNodeId = `node-${def.toPortId}` as NodeId;
      
      const fromNode = this.nodes.get(fromNodeId);
      const toNode = this.nodes.get(toNodeId);
      
      if (!fromNode || !toNode) {
        throw new Error("Edge endpoints must reference existing nodes");
      }

      const intermediates = IntermediateNodeGenerator.generate(fromNode.position, toNode.position);
      
      let currentId = fromNodeId;
      for (let i = 0; i < intermediates.length; i++) {
        const nextId = `int-${++this.intermediateCount}` as NodeId;
        this.nodes.set(nextId, {
          id: nextId,
          type: 'INTERMEDIATE',
          position: intermediates[i]
        });
        
        this.createEdge(currentId, nextId, def.minimumCapability);
        currentId = nextId;
      }
      this.createEdge(currentId, toNodeId, def.minimumCapability);
    }
  }

  private createEdge(from: NodeId, to: NodeId, cap: VesselCapability) {
    const fromNode = this.nodes.get(from)!;
    const toNode = this.nodes.get(to)!;
    const dist = IntermediateNodeGenerator.calculateDistanceKm(fromNode.position, toNode.position);
    
    const edgeId = `edge-${from}-${to}` as EdgeId;
    
    if (this.edges.has(edgeId)) {
        return; // skip duplicate
    }
    
    const edge: NetworkEdge = {
      id: edgeId,
      fromNodeId: from,
      toNodeId: to,
      distanceKm: dist,
      minimumVesselCapability: cap
    };
    
    this.edges.set(edgeId, edge);
    
    const adjs = this.adjacency.get(from) || [];
    adjs.push(edgeId);
    this.adjacency.set(from, adjs);
  }

  build(): MaritimeNetwork {
    return new MaritimeNetwork(this.nodes, this.edges, this.adjacency);
  }
}
