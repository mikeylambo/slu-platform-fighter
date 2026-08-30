import type { FighterState } from './types.js';
import type { MatchInteractionPolicy } from './match.js';

export type MatchTeamId = 'red' | 'blue' | 'green' | 'yellow' | null;
export type TeamAssignments = Readonly<Record<string, MatchTeamId>>;

export interface TeamRules {
  enabled: boolean;
  friendlyFire: boolean;
  teamByParticipant: TeamAssignments;
}

export const FREE_FOR_ALL_TEAM_RULES: TeamRules = { enabled: false, friendlyFire: true, teamByParticipant: {} };

export function validateTeamRules(participantIds: readonly string[], rules: TeamRules): void {
  const unique = new Set(participantIds);
  if (unique.size !== participantIds.length) throw new Error('team rules require unique participant ids');
  if (!rules.enabled) return;
  for (const participantId of participantIds) {
    if (rules.teamByParticipant[participantId] === undefined || rules.teamByParticipant[participantId] === null) {
      throw new Error(`teams enabled but participant ${participantId} has no team`);
    }
  }
  const teams = new Set(participantIds.map((id) => rules.teamByParticipant[id]));
  if (teams.size < 2) throw new Error('team match requires at least two represented teams');
}

export function createTeamInteractionPolicy(rules: TeamRules): MatchInteractionPolicy {
  return {
    canTarget(attackerId: string, targetId: string): boolean {
      if (attackerId === targetId) return false;
      if (!rules.enabled || rules.friendlyFire) return true;
      const attackerTeam = rules.teamByParticipant[attackerId];
      const targetTeam = rules.teamByParticipant[targetId];
      if (attackerTeam === undefined || targetTeam === undefined || attackerTeam === null || targetTeam === null) return true;
      return attackerTeam !== targetTeam;
    },
  };
}

/** Returns the sole surviving team, or null while multiple/no teams remain. */
export function resolveWinningTeam(fighters: readonly FighterState[], rules: TeamRules): Exclude<MatchTeamId, null> | null {
  if (!rules.enabled) return null;
  const survivingTeams = new Set<Exclude<MatchTeamId, null>>();
  for (const fighter of fighters) {
    if (fighter.eliminated) continue;
    const team = rules.teamByParticipant[fighter.id];
    if (team !== undefined && team !== null) survivingTeams.add(team);
  }
  if (survivingTeams.size !== 1) return null;
  return [...survivingTeams][0] ?? null;
}
