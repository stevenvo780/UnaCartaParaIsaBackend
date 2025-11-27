import { GameState } from "../../types/game-types";
import {
  MarriageGroup,
  MarriageProposal,
  MarriageEvent,
  MarriageConfig,
  MarriageStats,
} from "../../types/simulation/marriage";
import { simulationEvents, GameEventNames } from "../core/events";
import { logger } from "../../../infrastructure/utils/logger";

import { injectable, inject } from "inversify";
import { TYPES } from "../../../config/Types";

@injectable()
export class MarriageSystem {
  private gameState: GameState;
  private config: MarriageConfig;
  private marriageGroups = new Map<string, MarriageGroup>();
  private groupIdCounter = 0;
  private pendingProposals = new Map<string, MarriageProposal>();
  private lastProposalCleanup = 0;
  private marriageHistory: MarriageEvent[] = [];
  private readonly MAX_HISTORY = 200;
  private readonly PROPOSAL_EXPIRATION_MS = 300000;

  constructor(@inject(TYPES.GameState) gameState: GameState) {
    this.gameState = gameState;
    this.config = {
      maxGroupSize: 8,
      baseDifficultyPerMember: 0.15,
      divorceChanceBase: 0.001,
      cohesionDecayPerMember: 0.08,
    };

    this.setupDeathListener();
  }

  /**
   * Removes a deceased agent from their marriage group.
   * This prevents ghost references to dead agents in marriage structures.
   */
  private setupDeathListener(): void {
    simulationEvents.on(
      GameEventNames.AGENT_DEATH,
      (data: { agentId?: string; entityId?: string }) => {
        const agentId = data.agentId || data.entityId;
        if (!agentId) return;
        this.removeAgentFromMarriage(agentId);
      },
    );
  }

  /**
   * Removes an agent from their marriage group (death, divorce, etc.)
   */
  public removeAgentFromMarriage(agentId: string): void {
    for (const [groupId, group] of this.marriageGroups) {
      const memberIndex = group.members.indexOf(agentId);
      if (memberIndex !== -1) {
        group.members.splice(memberIndex, 1);

        if (group.members.length < 2) {
          this.marriageGroups.delete(groupId);
          logger.debug(
            `💔 [MARRIAGE] Group ${groupId} dissolved after member ${agentId} removed`,
          );
        } else {
          group.cohesion = Math.max(
            0.3,
            1.0 - group.members.length * this.config.cohesionDecayPerMember,
          );
        }
        break;
      }
    }

    this.pendingProposals.delete(agentId);
    for (const [targetId, proposal] of this.pendingProposals) {
      if (proposal.proposerId === agentId) {
        this.pendingProposals.delete(targetId);
      }
    }
  }

  public proposeMarriage(
    proposerId: string,
    targetId: string,
    proposerGroupId?: string,
  ): boolean {
    const proposerGroup = proposerGroupId
      ? this.marriageGroups.get(proposerGroupId)
      : null;

    if (
      proposerGroup &&
      proposerGroup.members.length >= this.config.maxGroupSize
    ) {
      return false;
    }

    this.pendingProposals.set(targetId, {
      proposerId,
      targetGroupId: proposerGroup?.id,
      timestamp: Date.now(),
    });

    logger.debug(`💍 [MARRIAGE] Proposal: ${proposerId} -> ${targetId}`);

    simulationEvents.emit(GameEventNames.MARRIAGE_PROPOSED, {
      proposerId,
      targetId,
      groupId: proposerGroup?.id,
      timestamp: Date.now(),
    });

    return true;
  }

  public acceptProposal(targetId: string): {
    success: boolean;
    groupId?: string;
  } {
    const proposal = this.pendingProposals.get(targetId);
    if (!proposal) return { success: false };

    let group: MarriageGroup;

    if (proposal.targetGroupId) {
      group = this.marriageGroups.get(proposal.targetGroupId)!;
      if (!group) return { success: false };

      group.members.push(targetId);
      group.cohesion = Math.max(
        0.3,
        1.0 - group.members.length * this.config.cohesionDecayPerMember,
      );

      this.addHistoryEvent("joined", targetId, group.id, proposal.proposerId);

      simulationEvents.emit(GameEventNames.MARRIAGE_MEMBER_JOINED, {
        agentId: targetId,
        groupId: group.id,
        proposerId: proposal.proposerId,
        timestamp: Date.now(),
      });
    } else {
      group = this.createMarriageGroup([proposal.proposerId, targetId]);
      this.addHistoryEvent("formed", targetId, group.id, proposal.proposerId);

      simulationEvents.emit(GameEventNames.MARRIAGE_GROUP_FORMED, {
        groupId: group.id,
        members: group.members,
        proposerId: proposal.proposerId,
        targetId,
        timestamp: Date.now(),
      });
    }

    this.pendingProposals.delete(targetId);

    simulationEvents.emit(GameEventNames.MARRIAGE_ACCEPTED, {
      proposerId: proposal.proposerId,
      targetId,
      groupId: group.id,
      timestamp: Date.now(),
    });

    return { success: true, groupId: group.id };
  }

  public rejectProposal(targetId: string): boolean {
    const proposal = this.pendingProposals.get(targetId);
    if (!proposal) return false;

    this.addHistoryEvent("rejected", targetId, undefined, proposal.proposerId);
    this.pendingProposals.delete(targetId);

    simulationEvents.emit(GameEventNames.MARRIAGE_REJECTED, {
      proposerId: proposal.proposerId,
      targetId,
      timestamp: Date.now(),
    });

    return true;
  }

  public initiateDivorce(
    agentId: string,
    groupId: string,
    reason: "mutual" | "conflict" = "mutual",
  ): boolean {
    const group = this.marriageGroups.get(groupId);
    if (!group) return false;

    simulationEvents.emit(GameEventNames.DIVORCE_INITIATED, {
      agentId,
      groupId,
      reason,
      timestamp: Date.now(),
    });

    const remainingMembers = group.members.filter((id) => id !== agentId);

    simulationEvents.emit(GameEventNames.MARRIAGE_MEMBER_LEFT, {
      agentId,
      groupId,
      reason,
      remainingMembers,
      timestamp: Date.now(),
    });

    group.members = remainingMembers;

    if (group.members.length <= 1) {
      this.marriageGroups.delete(groupId);
    }

    this.addHistoryEvent("dissolved", agentId, groupId, undefined, reason);

    simulationEvents.emit(GameEventNames.DIVORCE_COMPLETED, {
      agentId,
      groupId,
      reason,
      remainingMembers: group.members,
      timestamp: Date.now(),
    });

    return true;
  }

  public handleMemberDeath(deceasedId: string, groupId: string): void {
    const group = this.marriageGroups.get(groupId);
    if (!group) return;

    group.members = group.members.filter((id) => id !== deceasedId);

    for (const memberId of group.members) {
      this.addHistoryEvent("widowed", memberId, groupId, deceasedId, "death");

      simulationEvents.emit(GameEventNames.WIDOWHOOD_REGISTERED, {
        agentId: memberId,
        deceasedId,
        groupId,
        timestamp: Date.now(),
      });
    }

    if (group.members.length <= 1) {
      this.marriageGroups.delete(groupId);
    }
  }

  private createMarriageGroup(memberIds: string[]): MarriageGroup {
    const groupId = `marriage_${++this.groupIdCounter}`;

    const group: MarriageGroup = {
      id: groupId,
      members: memberIds,
      foundedDate: Date.now(),
      cohesion: 1.0 - memberIds.length * this.config.cohesionDecayPerMember,
      sharedResources: Math.random() < 0.7,
      children: [],
    };

    this.marriageGroups.set(groupId, group);
    return group;
  }

  private addHistoryEvent(
    type: MarriageEvent["type"],
    agentId: string,
    groupId?: string,
    partnerId?: string,
    reason?: string,
  ): void {
    const event: MarriageEvent = {
      timestamp: Date.now(),
      type,
      agentId,
      groupId,
      partnerId,
      reason,
    };

    this.marriageHistory.push(event);
    if (this.marriageHistory.length > this.MAX_HISTORY) {
      this.marriageHistory.shift();
    }
  }

  public update(): void {
    const now = Date.now();

    if (now - this.lastProposalCleanup >= 60000) {
      const proposalsEntries = Array.from(this.pendingProposals.entries());
      for (const [targetId, proposal] of proposalsEntries) {
        if (now - proposal.timestamp > this.PROPOSAL_EXPIRATION_MS) {
          this.pendingProposals.delete(targetId);
        }
      }
      this.lastProposalCleanup = now;
    }

    for (const group of Array.from(this.marriageGroups.values())) {
      group.cohesion = Math.max(0, group.cohesion - 0.0001);

      if (group.cohesion < 0.3 && group.members.length > 2) {
        const divorceChance =
          this.config.divorceChanceBase *
          (1 + group.members.length * 0.2) *
          (1 - group.cohesion);

        if (Math.random() < divorceChance && group.members.length > 0) {
          const memberToLeave =
            group.members[Math.floor(Math.random() * group.members.length)];
          this.initiateDivorce(memberToLeave, group.id, "conflict");
        }
      }
    }

    // NOTE: Source of truth is this.marriageGroups Map.
    // gameState.marriage is a READ-ONLY SNAPSHOT for frontend/serialization.
    // All modifications must go through MarriageSystem methods, not gameState directly.
    this.syncToGameState();
  }

  /**
   * Syncs internal state to gameState for frontend/serialization.
   * This is a one-way sync - gameState.marriage is READ-ONLY.
   * Source of truth: this.marriageGroups Map
   */
  private syncToGameState(): void {
    if (!this.gameState.marriage) {
      this.gameState.marriage = {
        groups: [],
        proposals: [],
        stats: {
          totalMarriages: 0,
          totalMembers: 0,
          avgGroupSize: 0,
          avgCohesion: 0,
          largestGroup: 0,
          activeProposals: 0,
        },
      };
    }

    this.gameState.marriage.groups = Array.from(this.marriageGroups.values());
    this.gameState.marriage.proposals = this.getPendingProposals();
    this.gameState.marriage.stats = this.getMarriageStats();
  }

  public getMarriageGroup(groupId: string): MarriageGroup | undefined {
    return this.marriageGroups.get(groupId);
  }

  public getAllMarriageGroups(): MarriageGroup[] {
    return Array.from(this.marriageGroups.values());
  }

  public getMarriageGroupsArray(): MarriageGroup[] {
    return Array.from(this.marriageGroups.values());
  }

  public areMarried(agentId1: string, agentId2: string): boolean {
    for (const group of Array.from(this.marriageGroups.values())) {
      if (
        group.members.includes(agentId1) &&
        group.members.includes(agentId2)
      ) {
        return true;
      }
    }
    return false;
  }

  public getMarriageBenefits(groupId: string): {
    moralBonus: number;
    productivityBonus: number;
    socialBonus: number;
  } {
    const group = this.marriageGroups.get(groupId);

    if (!group) {
      return { moralBonus: 0, productivityBonus: 0, socialBonus: 0 };
    }

    const sizeModifier = Math.max(0.5, 1.0 - group.members.length * 0.1);

    return {
      moralBonus: 10 * group.cohesion * sizeModifier,
      productivityBonus: 1.0 + 0.2 * group.cohesion * sizeModifier,
      socialBonus: 5 * group.cohesion,
    };
  }

  public addChildToGroup(groupId: string, childId: string): boolean {
    const group = this.marriageGroups.get(groupId);
    if (!group) return false;

    if (!group.children) group.children = [];
    group.children.push(childId);

    return true;
  }

  public getPendingProposals(): Array<{
    targetId: string;
    proposerId: string;
    timestamp: number;
  }> {
    return Array.from(this.pendingProposals.entries()).map(
      ([targetId, proposal]) => ({
        targetId,
        proposerId: proposal.proposerId,
        timestamp: proposal.timestamp,
      }),
    );
  }

  public getMarriageHistory(agentId?: string, limit = 50): MarriageEvent[] {
    let events = this.marriageHistory;
    if (agentId) {
      events = events.filter(
        (e) => e.agentId === agentId || e.partnerId === agentId,
      );
    }
    return events.slice(-limit).sort((a, b) => b.timestamp - a.timestamp);
  }

  public getMarriageStats(): MarriageStats {
    const groups = Array.from(this.marriageGroups.values());
    const totalMembers = groups.reduce((sum, g) => sum + g.members.length, 0);
    const avgGroupSize = groups.length > 0 ? totalMembers / groups.length : 0;
    const avgCohesion =
      groups.length > 0
        ? groups.reduce((sum, g) => sum + g.cohesion, 0) / groups.length
        : 0;
    const largestGroup = groups.reduce(
      (max, g) => Math.max(max, g.members.length),
      0,
    );

    return {
      totalMarriages: this.marriageGroups.size,
      totalMembers,
      avgGroupSize,
      avgCohesion,
      largestGroup,
      activeProposals: this.pendingProposals.size,
    };
  }

  public cleanup(): void {
    this.marriageGroups.clear();
    this.pendingProposals.clear();
    this.marriageHistory = [];
  }
}
