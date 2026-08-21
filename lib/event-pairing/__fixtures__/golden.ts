/**
 * lib/event-pairing/__fixtures__/golden.ts — golden parity 기대값 (Phase 2A-9D-B79-2).
 *
 * 생성 방법: scratchpad 의 독립 oracle(engine5)로 lineup 과 핵심 summary 를 만들고,
 * 그 parity 가 통과한 상태에서만 제품 canonical 출력(resultHash/warnings)을 고정했다.
 * 제품 코드가 자기 결과로 이 파일을 자동 갱신하지 않는다 — 의도적 변경은 사람이
 * diff 를 확인하고 손으로 반영한다.
 *
 * oracle source SHA-256: ee68d3228ed84b36a7f2c975ad5933fb1d08beec513cc35c436b5f74fe41b609
 */
import type {
  PairingConfigSnapshotV1,
  PairingGameDecision,
  PairingInputSnapshotV1,
  PairingReason,
  PairingSummary,
  PairingWarning,
} from "../types.ts";

/** 모든 fixture 가 공유하는 capture inputHash 자리표시자. */
export const GOLDEN_INPUT_HASH = "0000000000000000000000000000000000000000000000000000000000000001";

export interface GoldenCase {
  readonly label: string;
  readonly seed: string;
  /** sha256(canonical({config,input,seed})) — fixture 가 바뀌면 즉시 드러난다. */
  readonly fixtureHash: string;
  readonly config: PairingConfigSnapshotV1;
  readonly input: PairingInputSnapshotV1;
  readonly expectFailure: boolean;
  readonly reason?: PairingReason;
  readonly games?: readonly PairingGameDecision[];
  readonly summary?: PairingSummary;
  readonly warnings?: readonly PairingWarning[];
  readonly resultHash?: string;
}

export const GOLDEN_CASES: readonly GoldenCase[] = [
  {
    "label": "6p-1court-10games-open",
    "seed": "golden-6p",
    "fixtureHash": "7dcbdc20c64e5372557bfba1008ab4ae1a1f6cebe5208c1904849aaff7c390d6",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 1604,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000003",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 1604,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000004",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 160,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000005",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 80,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000006",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 80,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000007",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 160,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000008",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 80,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000009",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 80,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000010",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 160,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 10,
      "schedulingBatchCount": 10,
      "assignedGameCount": 10,
      "eligibleParticipantCount": 6,
      "appearanceMin": 6,
      "appearanceMax": 7,
      "appearanceSpread": 1,
      "maxConsecutiveStreak": 2,
      "distinctPartnerPairs": 9,
      "maxPartnerRepeat": 5,
      "distinctOpponentPairs": 15,
      "maxOpponentRepeat": 4,
      "averagePowerDifferenceBp": 401,
      "maxPowerDifferenceBp": 1604,
      "relaxedConstraintCount": 0
    },
    "warnings": [
      {
        "code": "POWER_TOLERANCE_APPLIED",
        "evidence": {
          "epsilonBp": 2000,
          "maxObservedDiffBp": 1604
        }
      },
      {
        "code": "REPEAT_LIMIT_RELAXED",
        "evidence": {
          "partnerConfiguredLimit": 1,
          "partnerMaxObserved": 5,
          "partnerExceededPairCount": 3,
          "opponentConfiguredLimit": 1,
          "opponentMaxObserved": 4,
          "opponentExceededPairCount": 15,
          "defaultLimitApplied": 1
        }
      }
    ],
    "resultHash": "9b672fcba6d63d06cf0e491c338f4a0dc13d5dad7ee02c74fb6f24799b1e6779",
    "config": {
      "version": 1,
      "slot_mode": "none",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 0,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000003",
          "position": 3,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000004",
          "position": 4,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000005",
          "position": 5,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000006",
          "position": 6,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000007",
          "position": 7,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000008",
          "position": 8,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000009",
          "position": 9,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000010",
          "position": 10,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "8p-1court-12games-vA",
    "seed": "golden-8p-vA",
    "fixtureHash": "7d8705c15589923f17f3dfbd1ab3bd28eb27a6000d42ec647adb9e5cb11342c1",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 41,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 2,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000003",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 147,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000004",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 102,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000005",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 1,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000006",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 1686,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000007",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 2590,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000008",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 2549,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000009",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 863,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000010",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000002"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 2548,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000011",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 1584,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000012",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000003"
        ],
        "powerDifferenceBp": 105,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 12,
      "schedulingBatchCount": 12,
      "assignedGameCount": 12,
      "eligibleParticipantCount": 8,
      "appearanceMin": 6,
      "appearanceMax": 6,
      "appearanceSpread": 0,
      "maxConsecutiveStreak": 2,
      "distinctPartnerPairs": 23,
      "maxPartnerRepeat": 2,
      "distinctOpponentPairs": 27,
      "maxOpponentRepeat": 4,
      "averagePowerDifferenceBp": 1018,
      "maxPowerDifferenceBp": 2590,
      "relaxedConstraintCount": 0
    },
    "warnings": [
      {
        "code": "POWER_TOLERANCE_APPLIED",
        "evidence": {
          "epsilonBp": 2000,
          "maxObservedDiffBp": 2590
        }
      },
      {
        "code": "REPEAT_LIMIT_RELAXED",
        "evidence": {
          "partnerConfiguredLimit": 1,
          "partnerMaxObserved": 2,
          "partnerExceededPairCount": 1,
          "opponentConfiguredLimit": 1,
          "opponentMaxObserved": 4,
          "opponentExceededPairCount": 15,
          "defaultLimitApplied": 1
        }
      }
    ],
    "resultHash": "82736b34daac23960a1a47b5a6189319348ca6e9f8504818fe03a14859edb8f7",
    "config": {
      "version": 1,
      "slot_mode": "none",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000007",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000007",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2006,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 7,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000008",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000008",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2007,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 8,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000003",
          "position": 3,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000004",
          "position": 4,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000005",
          "position": 5,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000006",
          "position": 6,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000007",
          "position": 7,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000008",
          "position": 8,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000009",
          "position": 9,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000010",
          "position": 10,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000011",
          "position": 11,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000012",
          "position": 12,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "8p-1court-12games-vB",
    "seed": "golden-8p-vB",
    "fixtureHash": "402d82e0a80e8814f6e45ba8dab1c762236f3da2d41a25493dc95e85383d4d8c",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 5,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 761,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000003",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 27,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000004",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 795,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000005",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 833,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000006",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 1577,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000007",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000007",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 2461,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000008",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000003"
        ],
        "powerDifferenceBp": 39,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000009",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 1650,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000010",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 872,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000011",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 794,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000012",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000003"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 1594,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 12,
      "schedulingBatchCount": 12,
      "assignedGameCount": 12,
      "eligibleParticipantCount": 8,
      "appearanceMin": 6,
      "appearanceMax": 6,
      "appearanceSpread": 0,
      "maxConsecutiveStreak": 2,
      "distinctPartnerPairs": 23,
      "maxPartnerRepeat": 2,
      "distinctOpponentPairs": 27,
      "maxOpponentRepeat": 5,
      "averagePowerDifferenceBp": 951,
      "maxPowerDifferenceBp": 2461,
      "relaxedConstraintCount": 0
    },
    "warnings": [
      {
        "code": "POWER_TOLERANCE_APPLIED",
        "evidence": {
          "epsilonBp": 2000,
          "maxObservedDiffBp": 2461
        }
      },
      {
        "code": "REPEAT_LIMIT_RELAXED",
        "evidence": {
          "partnerConfiguredLimit": 1,
          "partnerMaxObserved": 2,
          "partnerExceededPairCount": 1,
          "opponentConfiguredLimit": 1,
          "opponentMaxObserved": 5,
          "opponentExceededPairCount": 14,
          "defaultLimitApplied": 1
        }
      }
    ],
    "resultHash": "ff0b88f82adeba3340e4fc5a02ad47f1a1c625855d5de3d6fcc305c6bd4807c8",
    "config": {
      "version": 1,
      "slot_mode": "none",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 3,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 0,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000007",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000007",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2006,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 7,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 2,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000008",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000008",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2007,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 8,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 1,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000003",
          "position": 3,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000004",
          "position": 4,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000005",
          "position": 5,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000006",
          "position": 6,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000007",
          "position": 7,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000008",
          "position": 8,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000009",
          "position": 9,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000010",
          "position": 10,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000011",
          "position": 11,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000012",
          "position": 12,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "8p-1court-12games-flat",
    "seed": "golden-8p-flat",
    "fixtureHash": "4911143c5f6c05d333a71aa51c900093b6d4a4a11770763f94121d9bf8fdb0e9",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000003"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000007",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000003",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000004",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000005",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000006",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000007",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000008",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000009",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000010",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000003"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000011",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000012",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000002"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 12,
      "schedulingBatchCount": 12,
      "assignedGameCount": 12,
      "eligibleParticipantCount": 8,
      "appearanceMin": 6,
      "appearanceMax": 6,
      "appearanceSpread": 0,
      "maxConsecutiveStreak": 2,
      "distinctPartnerPairs": 24,
      "maxPartnerRepeat": 1,
      "distinctOpponentPairs": 28,
      "maxOpponentRepeat": 3,
      "averagePowerDifferenceBp": 0,
      "maxPowerDifferenceBp": 0,
      "relaxedConstraintCount": 0
    },
    "warnings": [
      {
        "code": "REPEAT_LIMIT_RELAXED",
        "evidence": {
          "partnerConfiguredLimit": 1,
          "partnerMaxObserved": 1,
          "partnerExceededPairCount": 0,
          "opponentConfiguredLimit": 1,
          "opponentMaxObserved": 3,
          "opponentExceededPairCount": 16,
          "defaultLimitApplied": 1
        }
      }
    ],
    "resultHash": "083bc34f1c641a95bd4a242089f84ea5d2512358adeee1ac977f1d40519bace5",
    "config": {
      "version": 1,
      "slot_mode": "none",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2010,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2010,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2010,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2010,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2010,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2010,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000007",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000007",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2010,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000008",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000008",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2010,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000003",
          "position": 3,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000004",
          "position": 4,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000005",
          "position": 5,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000006",
          "position": 6,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000007",
          "position": 7,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000008",
          "position": 8,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000009",
          "position": 9,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000010",
          "position": 10,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000011",
          "position": 11,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000012",
          "position": 12,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "8p-2court-6batch-ordered",
    "seed": "golden-8p-2c",
    "fixtureHash": "fbfe93dddd96dd8120951dc3bd20846b6675fbd093ea28bf07a6088a8bdd0793",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 43,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000003",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 2590,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000004",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 2549,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000005",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 823,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000006",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 866,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000007",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 718,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000008",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000003"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 2401,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000009",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 761,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000010",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 2444,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000011",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000003"
        ],
        "powerDifferenceBp": 824,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000012",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 865,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 12,
      "schedulingBatchCount": 6,
      "assignedGameCount": 12,
      "eligibleParticipantCount": 8,
      "appearanceMin": 6,
      "appearanceMax": 6,
      "appearanceSpread": 0,
      "maxConsecutiveStreak": 6,
      "distinctPartnerPairs": 24,
      "maxPartnerRepeat": 1,
      "distinctOpponentPairs": 26,
      "maxOpponentRepeat": 3,
      "averagePowerDifferenceBp": 1240,
      "maxPowerDifferenceBp": 2590,
      "relaxedConstraintCount": 1
    },
    "warnings": [
      {
        "code": "CONSECUTIVE_LIMIT_RELAXED",
        "evidence": {
          "limit": 2
        }
      },
      {
        "code": "POWER_TOLERANCE_APPLIED",
        "evidence": {
          "epsilonBp": 2000,
          "maxObservedDiffBp": 2590
        }
      },
      {
        "code": "REPEAT_LIMIT_RELAXED",
        "evidence": {
          "partnerConfiguredLimit": 1,
          "partnerMaxObserved": 1,
          "partnerExceededPairCount": 0,
          "opponentConfiguredLimit": 1,
          "opponentMaxObserved": 3,
          "opponentExceededPairCount": 16,
          "defaultLimitApplied": 1
        }
      }
    ],
    "resultHash": "13763d8124c607ad5cde2e5f65d6b84d5dd6567c90d5406dc7a2894c7a2274a7",
    "config": {
      "version": 1,
      "slot_mode": "ordered",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000007",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000007",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2006,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 7,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000008",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000008",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2007,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 8,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000001",
          "sessionPosition": 1,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000002",
          "courtPosition": 2,
          "sessionId": "66666666-0000-4000-8000-000000000001",
          "sessionPosition": 1,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000003",
          "position": 3,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000002",
          "sessionPosition": 2,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000004",
          "position": 4,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000002",
          "courtPosition": 2,
          "sessionId": "66666666-0000-4000-8000-000000000002",
          "sessionPosition": 2,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000005",
          "position": 5,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000003",
          "sessionPosition": 3,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000006",
          "position": 6,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000002",
          "courtPosition": 2,
          "sessionId": "66666666-0000-4000-8000-000000000003",
          "sessionPosition": 3,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000007",
          "position": 7,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000004",
          "sessionPosition": 4,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000008",
          "position": 8,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000002",
          "courtPosition": 2,
          "sessionId": "66666666-0000-4000-8000-000000000004",
          "sessionPosition": 4,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000009",
          "position": 9,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000005",
          "sessionPosition": 5,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000010",
          "position": 10,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000002",
          "courtPosition": 2,
          "sessionId": "66666666-0000-4000-8000-000000000005",
          "sessionPosition": 5,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000011",
          "position": 11,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000006",
          "sessionPosition": 6,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000012",
          "position": 12,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000002",
          "courtPosition": 2,
          "sessionId": "66666666-0000-4000-8000-000000000006",
          "sessionPosition": 6,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "12p-3court-ordered",
    "seed": "golden-12p-ordered",
    "fixtureHash": "f8c9dba143cd0b5643917a076d5bc354ce2a59cc229861818cab007fab9f4b11",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000009"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000011"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000010"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000003",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000012"
        ],
        "powerDifferenceBp": 111,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000004",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 52,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000005",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000012"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000010"
        ],
        "powerDifferenceBp": 178,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000006",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000009"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000007",
          "bbbbbbbb-0000-4000-8000-000000000011"
        ],
        "powerDifferenceBp": 1819,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000007",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000007",
          "bbbbbbbb-0000-4000-8000-000000000012"
        ],
        "powerDifferenceBp": 188,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000008",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000010"
        ],
        "powerDifferenceBp": 1666,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000009",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000009",
          "bbbbbbbb-0000-4000-8000-000000000011"
        ],
        "powerDifferenceBp": 111,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000010",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000012"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000011"
        ],
        "powerDifferenceBp": 737,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000011",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000010"
        ],
        "powerDifferenceBp": 1993,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000012",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000009"
        ],
        "powerDifferenceBp": 2267,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 12,
      "schedulingBatchCount": 4,
      "assignedGameCount": 12,
      "eligibleParticipantCount": 12,
      "appearanceMin": 4,
      "appearanceMax": 4,
      "appearanceSpread": 0,
      "maxConsecutiveStreak": 4,
      "distinctPartnerPairs": 24,
      "maxPartnerRepeat": 1,
      "distinctOpponentPairs": 47,
      "maxOpponentRepeat": 2,
      "averagePowerDifferenceBp": 760,
      "maxPowerDifferenceBp": 2267,
      "relaxedConstraintCount": 1
    },
    "warnings": [
      {
        "code": "CONSECUTIVE_LIMIT_RELAXED",
        "evidence": {
          "limit": 2
        }
      },
      {
        "code": "POWER_TOLERANCE_APPLIED",
        "evidence": {
          "epsilonBp": 2000,
          "maxObservedDiffBp": 2267
        }
      },
      {
        "code": "REPEAT_LIMIT_RELAXED",
        "evidence": {
          "partnerConfiguredLimit": 1,
          "partnerMaxObserved": 1,
          "partnerExceededPairCount": 0,
          "opponentConfiguredLimit": 1,
          "opponentMaxObserved": 2,
          "opponentExceededPairCount": 1,
          "defaultLimitApplied": 1
        }
      }
    ],
    "resultHash": "bc6d4eba16d9555ac64909d0d2359cf86a4a2118a165b80156a949a3a302e3f9",
    "config": {
      "version": 1,
      "slot_mode": "ordered",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 1,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 0,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000007",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000007",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2006,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 7,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 0,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000008",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000008",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2007,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 8,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000009",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000009",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2008,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 9,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000010",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000010",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2009,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000011",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000011",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2010,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000012",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000012",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2011,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000001",
          "sessionPosition": 1,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000002",
          "courtPosition": 2,
          "sessionId": "66666666-0000-4000-8000-000000000001",
          "sessionPosition": 1,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000003",
          "position": 3,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000003",
          "courtPosition": 3,
          "sessionId": "66666666-0000-4000-8000-000000000001",
          "sessionPosition": 1,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000004",
          "position": 4,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000002",
          "sessionPosition": 2,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000005",
          "position": 5,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000002",
          "courtPosition": 2,
          "sessionId": "66666666-0000-4000-8000-000000000002",
          "sessionPosition": 2,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000006",
          "position": 6,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000003",
          "courtPosition": 3,
          "sessionId": "66666666-0000-4000-8000-000000000002",
          "sessionPosition": 2,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000007",
          "position": 7,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000003",
          "sessionPosition": 3,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000008",
          "position": 8,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000002",
          "courtPosition": 2,
          "sessionId": "66666666-0000-4000-8000-000000000003",
          "sessionPosition": 3,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000009",
          "position": 9,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000003",
          "courtPosition": 3,
          "sessionId": "66666666-0000-4000-8000-000000000003",
          "sessionPosition": 3,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000010",
          "position": 10,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000004",
          "sessionPosition": 4,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000011",
          "position": 11,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000002",
          "courtPosition": 2,
          "sessionId": "66666666-0000-4000-8000-000000000004",
          "sessionPosition": 4,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000012",
          "position": 12,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000003",
          "courtPosition": 3,
          "sessionId": "66666666-0000-4000-8000-000000000004",
          "sessionPosition": 4,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "12p-3court-timed",
    "seed": "golden-12p-timed",
    "fixtureHash": "18c05920f29d031b9d043d945ed118ee794f1aa91555c2ed88b6d7a65cf05e4a",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000011"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000010"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000009"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000003",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000012"
        ],
        "powerDifferenceBp": 111,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000004",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 52,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000005",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000012"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000010"
        ],
        "powerDifferenceBp": 178,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000006",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000009"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000007",
          "bbbbbbbb-0000-4000-8000-000000000011"
        ],
        "powerDifferenceBp": 1819,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000007",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000007",
          "bbbbbbbb-0000-4000-8000-000000000012"
        ],
        "powerDifferenceBp": 188,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000008",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000010"
        ],
        "powerDifferenceBp": 1666,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000009",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000009",
          "bbbbbbbb-0000-4000-8000-000000000011"
        ],
        "powerDifferenceBp": 111,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000010",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000012"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000011"
        ],
        "powerDifferenceBp": 737,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000011",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000010"
        ],
        "powerDifferenceBp": 1993,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000012",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000009"
        ],
        "powerDifferenceBp": 2267,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 12,
      "schedulingBatchCount": 4,
      "assignedGameCount": 12,
      "eligibleParticipantCount": 12,
      "appearanceMin": 4,
      "appearanceMax": 4,
      "appearanceSpread": 0,
      "maxConsecutiveStreak": 4,
      "distinctPartnerPairs": 24,
      "maxPartnerRepeat": 1,
      "distinctOpponentPairs": 47,
      "maxOpponentRepeat": 2,
      "averagePowerDifferenceBp": 760,
      "maxPowerDifferenceBp": 2267,
      "relaxedConstraintCount": 1
    },
    "warnings": [
      {
        "code": "CONSECUTIVE_LIMIT_RELAXED",
        "evidence": {
          "limit": 2
        }
      },
      {
        "code": "POWER_TOLERANCE_APPLIED",
        "evidence": {
          "epsilonBp": 2000,
          "maxObservedDiffBp": 2267
        }
      },
      {
        "code": "REPEAT_LIMIT_RELAXED",
        "evidence": {
          "partnerConfiguredLimit": 1,
          "partnerMaxObserved": 1,
          "partnerExceededPairCount": 0,
          "opponentConfiguredLimit": 1,
          "opponentMaxObserved": 2,
          "opponentExceededPairCount": 1,
          "defaultLimitApplied": 1
        }
      }
    ],
    "resultHash": "5d20f00240dc69298ce5c22c5ffd42959053ba1a046138fd515801be63b37c09",
    "config": {
      "version": 1,
      "slot_mode": "timed",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 1,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 0,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000007",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000007",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2006,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 7,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 0,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000008",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000008",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2007,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 8,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000009",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000009",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2008,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 9,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000010",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000010",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2009,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000011",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000011",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2010,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000012",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000012",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2011,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000001",
          "sessionPosition": 1,
          "sessionStartsAt": "2026-07-15T10:00:00Z",
          "sessionEndsAt": "2026-07-15T10:30:00Z"
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000002",
          "courtPosition": 2,
          "sessionId": "66666666-0000-4000-8000-000000000001",
          "sessionPosition": 1,
          "sessionStartsAt": "2026-07-15T10:00:00Z",
          "sessionEndsAt": "2026-07-15T10:30:00Z"
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000003",
          "position": 3,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000003",
          "courtPosition": 3,
          "sessionId": "66666666-0000-4000-8000-000000000001",
          "sessionPosition": 1,
          "sessionStartsAt": "2026-07-15T10:00:00Z",
          "sessionEndsAt": "2026-07-15T10:30:00Z"
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000004",
          "position": 4,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000002",
          "sessionPosition": 2,
          "sessionStartsAt": "2026-07-15T10:30:00Z",
          "sessionEndsAt": "2026-07-15T11:00:00Z"
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000005",
          "position": 5,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000002",
          "courtPosition": 2,
          "sessionId": "66666666-0000-4000-8000-000000000002",
          "sessionPosition": 2,
          "sessionStartsAt": "2026-07-15T10:30:00Z",
          "sessionEndsAt": "2026-07-15T11:00:00Z"
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000006",
          "position": 6,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000003",
          "courtPosition": 3,
          "sessionId": "66666666-0000-4000-8000-000000000002",
          "sessionPosition": 2,
          "sessionStartsAt": "2026-07-15T10:30:00Z",
          "sessionEndsAt": "2026-07-15T11:00:00Z"
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000007",
          "position": 7,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000003",
          "sessionPosition": 3,
          "sessionStartsAt": "2026-07-15T11:00:00Z",
          "sessionEndsAt": "2026-07-15T11:30:00Z"
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000008",
          "position": 8,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000002",
          "courtPosition": 2,
          "sessionId": "66666666-0000-4000-8000-000000000003",
          "sessionPosition": 3,
          "sessionStartsAt": "2026-07-15T11:00:00Z",
          "sessionEndsAt": "2026-07-15T11:30:00Z"
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000009",
          "position": 9,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000003",
          "courtPosition": 3,
          "sessionId": "66666666-0000-4000-8000-000000000003",
          "sessionPosition": 3,
          "sessionStartsAt": "2026-07-15T11:00:00Z",
          "sessionEndsAt": "2026-07-15T11:30:00Z"
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000010",
          "position": 10,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000004",
          "sessionPosition": 4,
          "sessionStartsAt": "2026-07-15T11:30:00Z",
          "sessionEndsAt": "2026-07-15T12:00:00Z"
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000011",
          "position": 11,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000002",
          "courtPosition": 2,
          "sessionId": "66666666-0000-4000-8000-000000000004",
          "sessionPosition": 4,
          "sessionStartsAt": "2026-07-15T11:30:00Z",
          "sessionEndsAt": "2026-07-15T12:00:00Z"
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000012",
          "position": 12,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000003",
          "courtPosition": 3,
          "sessionId": "66666666-0000-4000-8000-000000000004",
          "sessionPosition": 4,
          "sessionStartsAt": "2026-07-15T11:30:00Z",
          "sessionEndsAt": "2026-07-15T12:00:00Z"
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "timed-chained-overlap",
    "seed": "golden-chain",
    "fixtureHash": "4ede52397c2f374f338cc1fd2d338e7a38b2c668b1818a140978abc59f9030ec",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 41,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 2,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000003",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 41,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 3,
      "schedulingBatchCount": 3,
      "assignedGameCount": 3,
      "eligibleParticipantCount": 8,
      "appearanceMin": 1,
      "appearanceMax": 2,
      "appearanceSpread": 1,
      "maxConsecutiveStreak": 2,
      "distinctPartnerPairs": 4,
      "maxPartnerRepeat": 2,
      "distinctOpponentPairs": 8,
      "maxOpponentRepeat": 2,
      "averagePowerDifferenceBp": 28,
      "maxPowerDifferenceBp": 41,
      "relaxedConstraintCount": 0
    },
    "warnings": [
      {
        "code": "POWER_TOLERANCE_APPLIED",
        "evidence": {
          "epsilonBp": 2000,
          "maxObservedDiffBp": 41
        }
      },
      {
        "code": "REPEAT_LIMIT_RELAXED",
        "evidence": {
          "partnerConfiguredLimit": 1,
          "partnerMaxObserved": 2,
          "partnerExceededPairCount": 2,
          "opponentConfiguredLimit": 1,
          "opponentMaxObserved": 2,
          "opponentExceededPairCount": 4,
          "defaultLimitApplied": 1
        }
      }
    ],
    "resultHash": "8f59fc3b83e4a84bad4d114a9c8bc3bdd0ed498e53a7edd1358e83f698c3191e",
    "config": {
      "version": 1,
      "slot_mode": "timed",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000007",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000007",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2006,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 7,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000008",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000008",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2007,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 8,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000001",
          "sessionPosition": 1,
          "sessionStartsAt": "2026-07-15T10:00:00Z",
          "sessionEndsAt": "2026-07-15T10:30:00Z"
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000002",
          "courtPosition": 2,
          "sessionId": "66666666-0000-4000-8000-000000000002",
          "sessionPosition": 2,
          "sessionStartsAt": "2026-07-15T10:15:00Z",
          "sessionEndsAt": "2026-07-15T10:45:00Z"
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000003",
          "position": 3,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000003",
          "sessionPosition": 3,
          "sessionStartsAt": "2026-07-15T10:30:00Z",
          "sessionEndsAt": "2026-07-15T11:00:00Z"
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "ordered-position-gap-1-to-3",
    "seed": "golden-gap",
    "fixtureHash": "8308464796b2e8c7563ef6720c51c3f55145a4ac8ce2efbac57444daadd5845f",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 80,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 2,
      "schedulingBatchCount": 2,
      "assignedGameCount": 2,
      "eligibleParticipantCount": 6,
      "appearanceMin": 1,
      "appearanceMax": 2,
      "appearanceSpread": 1,
      "maxConsecutiveStreak": 1,
      "distinctPartnerPairs": 4,
      "maxPartnerRepeat": 1,
      "distinctOpponentPairs": 8,
      "maxOpponentRepeat": 1,
      "averagePowerDifferenceBp": 40,
      "maxPowerDifferenceBp": 80,
      "relaxedConstraintCount": 0
    },
    "warnings": [
      {
        "code": "POWER_TOLERANCE_APPLIED",
        "evidence": {
          "epsilonBp": 2000,
          "maxObservedDiffBp": 80
        }
      }
    ],
    "resultHash": "fff042da113ce49a09c3065a74686c411307df205cb619080557fafbab49d866",
    "config": {
      "version": 1,
      "slot_mode": "ordered",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 0,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000001",
          "sessionPosition": 1,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": "55555555-0000-4000-8000-000000000001",
          "courtPosition": 1,
          "sessionId": "66666666-0000-4000-8000-000000000003",
          "sessionPosition": 3,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "mixed-shortage",
    "seed": "golden-shortage",
    "fixtureHash": "f571e7efcd35fb74edbb68dbbcb9fdd19b34401ee644bd883e7aea8d18b87fa1",
    "expectFailure": true,
    "reason": "CATEGORY_SHORTAGE",
    "config": {
      "version": 1,
      "slot_mode": "none",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 0,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "unspecified",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "unspecified",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "unspecified",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "mixed",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "mixed",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000003",
          "position": 3,
          "format": "doubles",
          "genderCategory": "mixed",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "manual-base-plus-append",
    "seed": "golden-manual",
    "fixtureHash": "f1a0f4a5ed5cd3a5b373f476bb30712afebb3748dc00ace192de4d5d4bc988bd",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 681,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000003",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 841,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 3,
      "schedulingBatchCount": 3,
      "assignedGameCount": 3,
      "eligibleParticipantCount": 6,
      "appearanceMin": 2,
      "appearanceMax": 3,
      "appearanceSpread": 1,
      "maxConsecutiveStreak": 3,
      "distinctPartnerPairs": 8,
      "maxPartnerRepeat": 1,
      "distinctOpponentPairs": 13,
      "maxOpponentRepeat": 3,
      "averagePowerDifferenceBp": 507,
      "maxPowerDifferenceBp": 841,
      "relaxedConstraintCount": 0
    },
    "warnings": [
      {
        "code": "POWER_TOLERANCE_APPLIED",
        "evidence": {
          "epsilonBp": 2000,
          "maxObservedDiffBp": 841
        }
      },
      {
        "code": "REPEAT_LIMIT_RELAXED",
        "evidence": {
          "partnerConfiguredLimit": 1,
          "partnerMaxObserved": 1,
          "partnerExceededPairCount": 0,
          "opponentConfiguredLimit": 1,
          "opponentMaxObserved": 3,
          "opponentExceededPairCount": 2,
          "defaultLimitApplied": 1
        }
      }
    ],
    "resultHash": "a368cd60250e1a3b604725e26b095e8e0ef6c0c97ab66d974df365a1005fa4e6",
    "config": {
      "version": 1,
      "slot_mode": "none",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 0,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000003",
          "position": 3,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000090",
          "position": 90,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null,
          "status": "draft",
          "source": "manual",
          "pairingRunId": null,
          "lineup": [
            {
              "participantId": "bbbbbbbb-0000-4000-8000-000000000001",
              "team": "a",
              "slot": 1
            },
            {
              "participantId": "bbbbbbbb-0000-4000-8000-000000000002",
              "team": "a",
              "slot": 2
            },
            {
              "participantId": "bbbbbbbb-0000-4000-8000-000000000003",
              "team": "b",
              "slot": 1
            },
            {
              "participantId": "bbbbbbbb-0000-4000-8000-000000000004",
              "team": "b",
              "slot": 2
            }
          ]
        }
      ]
    }
  },
  {
    "label": "stable-prefix-n1",
    "seed": "golden-sp",
    "fixtureHash": "d70626a837a8e0e7a203b6910c4f76eaa237ec96a529df2004b7c85ec757eaae",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 0,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 1,
      "schedulingBatchCount": 1,
      "assignedGameCount": 1,
      "eligibleParticipantCount": 8,
      "appearanceMin": 0,
      "appearanceMax": 1,
      "appearanceSpread": 1,
      "maxConsecutiveStreak": 1,
      "distinctPartnerPairs": 2,
      "maxPartnerRepeat": 1,
      "distinctOpponentPairs": 4,
      "maxOpponentRepeat": 1,
      "averagePowerDifferenceBp": 0,
      "maxPowerDifferenceBp": 0,
      "relaxedConstraintCount": 0
    },
    "warnings": [
      {
        "code": "PAIRING_HORIZON_SHORT",
        "evidence": {
          "targetGameCount": 1,
          "schedulingBatchCount": 1,
          "configuredLookaheadDepth": 2,
          "effectiveLookaheadDepth": 1
        }
      }
    ],
    "resultHash": "36c31ef9854d068b2aa1df978479362f5ddabbc74eee4102fb36e129b1476ff6",
    "config": {
      "version": 1,
      "slot_mode": "none",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000007",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000007",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2006,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 7,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000008",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000008",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2007,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 8,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "stable-prefix-n2",
    "seed": "golden-sp",
    "fixtureHash": "021220617babb884172afbca287eb10d8cab6b5c7a0d3163dd1dc81a1b94f660",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 2,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 41,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 2,
      "schedulingBatchCount": 2,
      "assignedGameCount": 2,
      "eligibleParticipantCount": 8,
      "appearanceMin": 1,
      "appearanceMax": 1,
      "appearanceSpread": 0,
      "maxConsecutiveStreak": 1,
      "distinctPartnerPairs": 4,
      "maxPartnerRepeat": 1,
      "distinctOpponentPairs": 8,
      "maxOpponentRepeat": 1,
      "averagePowerDifferenceBp": 22,
      "maxPowerDifferenceBp": 41,
      "relaxedConstraintCount": 0
    },
    "warnings": [
      {
        "code": "POWER_TOLERANCE_APPLIED",
        "evidence": {
          "epsilonBp": 2000,
          "maxObservedDiffBp": 41
        }
      }
    ],
    "resultHash": "02baa07453883039387e696004e3ee4d8c460a3183cbb40f14f42d827813f0b4",
    "config": {
      "version": 1,
      "slot_mode": "none",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000007",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000007",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2006,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 7,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000008",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000008",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2007,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 8,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "stable-prefix-n3",
    "seed": "golden-sp",
    "fixtureHash": "872f1fe551046151ec606c1677fe9e7061424fbfd846f7381504b74af5119442",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 2,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 41,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000003",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 1,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 3,
      "schedulingBatchCount": 3,
      "assignedGameCount": 3,
      "eligibleParticipantCount": 8,
      "appearanceMin": 1,
      "appearanceMax": 2,
      "appearanceSpread": 1,
      "maxConsecutiveStreak": 2,
      "distinctPartnerPairs": 6,
      "maxPartnerRepeat": 1,
      "distinctOpponentPairs": 12,
      "maxOpponentRepeat": 1,
      "averagePowerDifferenceBp": 15,
      "maxPowerDifferenceBp": 41,
      "relaxedConstraintCount": 0
    },
    "warnings": [
      {
        "code": "POWER_TOLERANCE_APPLIED",
        "evidence": {
          "epsilonBp": 2000,
          "maxObservedDiffBp": 41
        }
      }
    ],
    "resultHash": "d54d9e64310edc203902630bc66a2bec3546205b9cca91637ee33cd477aea467",
    "config": {
      "version": 1,
      "slot_mode": "none",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000007",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000007",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2006,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 7,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000008",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000008",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2007,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 8,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000003",
          "position": 3,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "stable-prefix-n5",
    "seed": "golden-sp",
    "fixtureHash": "184add916263ce1d3947e72244f6f2ca5769aa448bfe3d48d9962fe6985711e3",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 2,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 41,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000003",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 147,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000004",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 102,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000005",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 1,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 5,
      "schedulingBatchCount": 5,
      "assignedGameCount": 5,
      "eligibleParticipantCount": 8,
      "appearanceMin": 2,
      "appearanceMax": 3,
      "appearanceSpread": 1,
      "maxConsecutiveStreak": 2,
      "distinctPartnerPairs": 10,
      "maxPartnerRepeat": 1,
      "distinctOpponentPairs": 20,
      "maxOpponentRepeat": 1,
      "averagePowerDifferenceBp": 59,
      "maxPowerDifferenceBp": 147,
      "relaxedConstraintCount": 0
    },
    "warnings": [
      {
        "code": "POWER_TOLERANCE_APPLIED",
        "evidence": {
          "epsilonBp": 2000,
          "maxObservedDiffBp": 147
        }
      }
    ],
    "resultHash": "64cc0f7793fc653977bd3891d962df1045665edd5533753746f999199376769c",
    "config": {
      "version": 1,
      "slot_mode": "none",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000007",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000007",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2006,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 7,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000008",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000008",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2007,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 8,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000003",
          "position": 3,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000004",
          "position": 4,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000005",
          "position": 5,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "stable-prefix-n8",
    "seed": "golden-sp",
    "fixtureHash": "dd7f73ee11af8c2463fd9a334986a25232627ba825fc3cd28829f360f6dc3f49",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 2,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 41,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000003",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 147,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000004",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 102,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000005",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 1,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000006",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 1686,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000007",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 2590,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000008",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 2549,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 8,
      "schedulingBatchCount": 8,
      "assignedGameCount": 8,
      "eligibleParticipantCount": 8,
      "appearanceMin": 4,
      "appearanceMax": 4,
      "appearanceSpread": 0,
      "maxConsecutiveStreak": 2,
      "distinctPartnerPairs": 15,
      "maxPartnerRepeat": 2,
      "distinctOpponentPairs": 25,
      "maxOpponentRepeat": 2,
      "averagePowerDifferenceBp": 890,
      "maxPowerDifferenceBp": 2590,
      "relaxedConstraintCount": 0
    },
    "warnings": [
      {
        "code": "POWER_TOLERANCE_APPLIED",
        "evidence": {
          "epsilonBp": 2000,
          "maxObservedDiffBp": 2590
        }
      },
      {
        "code": "REPEAT_LIMIT_RELAXED",
        "evidence": {
          "partnerConfiguredLimit": 1,
          "partnerMaxObserved": 2,
          "partnerExceededPairCount": 1,
          "opponentConfiguredLimit": 1,
          "opponentMaxObserved": 2,
          "opponentExceededPairCount": 7,
          "defaultLimitApplied": 1
        }
      }
    ],
    "resultHash": "6bb7159f1343f25748f0c21f8c83eb4034b0e84dd027256c912f087a24c74278",
    "config": {
      "version": 1,
      "slot_mode": "none",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000007",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000007",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2006,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 7,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000008",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000008",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2007,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 8,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000003",
          "position": 3,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000004",
          "position": 4,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000005",
          "position": 5,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000006",
          "position": 6,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000007",
          "position": 7,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000008",
          "position": 8,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "stable-prefix-n10",
    "seed": "golden-sp",
    "fixtureHash": "0102b0bff2bd685b9788e82449c4d03a7478b38c76e43b8403e857fdd35b75be",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 2,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 41,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000003",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 147,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000004",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 102,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000005",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 1,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000006",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 1686,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000007",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 2590,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000008",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 2549,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000009",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 863,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000010",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000002"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 2548,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 10,
      "schedulingBatchCount": 10,
      "assignedGameCount": 10,
      "eligibleParticipantCount": 8,
      "appearanceMin": 5,
      "appearanceMax": 5,
      "appearanceSpread": 0,
      "maxConsecutiveStreak": 2,
      "distinctPartnerPairs": 19,
      "maxPartnerRepeat": 2,
      "distinctOpponentPairs": 26,
      "maxOpponentRepeat": 3,
      "averagePowerDifferenceBp": 1053,
      "maxPowerDifferenceBp": 2590,
      "relaxedConstraintCount": 0
    },
    "warnings": [
      {
        "code": "POWER_TOLERANCE_APPLIED",
        "evidence": {
          "epsilonBp": 2000,
          "maxObservedDiffBp": 2590
        }
      },
      {
        "code": "REPEAT_LIMIT_RELAXED",
        "evidence": {
          "partnerConfiguredLimit": 1,
          "partnerMaxObserved": 2,
          "partnerExceededPairCount": 1,
          "opponentConfiguredLimit": 1,
          "opponentMaxObserved": 3,
          "opponentExceededPairCount": 11,
          "defaultLimitApplied": 1
        }
      }
    ],
    "resultHash": "dd5dad2057566be585488838adea1d7cdb9f7da83f2feda9d73d71d4fddf6526",
    "config": {
      "version": 1,
      "slot_mode": "none",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000007",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000007",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2006,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 7,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000008",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000008",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2007,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 8,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000003",
          "position": 3,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000004",
          "position": 4,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000005",
          "position": 5,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000006",
          "position": 6,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000007",
          "position": 7,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000008",
          "position": 8,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000009",
          "position": 9,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000010",
          "position": 10,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "stable-prefix-n15",
    "seed": "golden-sp",
    "fixtureHash": "b6b90fe17fe4b5aa2522c4eb8624ac1c8794dbff2f2c9a484396ed8c78178f0d",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 2,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 41,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000003",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 147,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000004",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 102,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000005",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 1,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000006",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 1686,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000007",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 2590,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000008",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 2549,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000009",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 863,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000010",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000002"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 2548,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000011",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 1584,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000012",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000003"
        ],
        "powerDifferenceBp": 105,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000013",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000007",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 2591,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000014",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000003"
        ],
        "powerDifferenceBp": 824,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000015",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000003"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 1540,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 15,
      "schedulingBatchCount": 15,
      "assignedGameCount": 15,
      "eligibleParticipantCount": 8,
      "appearanceMin": 7,
      "appearanceMax": 8,
      "appearanceSpread": 1,
      "maxConsecutiveStreak": 2,
      "distinctPartnerPairs": 28,
      "maxPartnerRepeat": 2,
      "distinctOpponentPairs": 27,
      "maxOpponentRepeat": 5,
      "averagePowerDifferenceBp": 1145,
      "maxPowerDifferenceBp": 2591,
      "relaxedConstraintCount": 0
    },
    "warnings": [
      {
        "code": "POWER_TOLERANCE_APPLIED",
        "evidence": {
          "epsilonBp": 2000,
          "maxObservedDiffBp": 2591
        }
      },
      {
        "code": "REPEAT_LIMIT_RELAXED",
        "evidence": {
          "partnerConfiguredLimit": 1,
          "partnerMaxObserved": 2,
          "partnerExceededPairCount": 2,
          "opponentConfiguredLimit": 1,
          "opponentMaxObserved": 5,
          "opponentExceededPairCount": 18,
          "defaultLimitApplied": 1
        }
      }
    ],
    "resultHash": "c347f2f19f0fc76a886fb77b3c4bc53c8e3bfecb8a41d32532e92e4d8c219655",
    "config": {
      "version": 1,
      "slot_mode": "none",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000007",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000007",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2006,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 7,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000008",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000008",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2007,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 8,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000003",
          "position": 3,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000004",
          "position": 4,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000005",
          "position": 5,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000006",
          "position": 6,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000007",
          "position": 7,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000008",
          "position": 8,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000009",
          "position": 9,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000010",
          "position": 10,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000011",
          "position": 11,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000012",
          "position": 12,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000013",
          "position": 13,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000014",
          "position": 14,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000015",
          "position": 15,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": []
    }
  },
  {
    "label": "stable-prefix-n20",
    "seed": "golden-sp",
    "fixtureHash": "6c3c69225f8c6c9c2649d6bda05ebdef82d8d6bac85058ba2bf97e4a5c2d93a4",
    "expectFailure": false,
    "games": [
      {
        "gameId": "dddddddd-0000-4000-8000-000000000001",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 2,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "SEED_TIE_BREAK",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000002",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 41,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000003",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 147,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000004",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 102,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000005",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 1,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000006",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 1686,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000007",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 2590,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000008",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 2549,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000009",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 863,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000010",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000002"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "powerDifferenceBp": 2548,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000011",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 1584,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000012",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000003"
        ],
        "powerDifferenceBp": 105,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000013",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000005",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000007",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 2591,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000014",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000003"
        ],
        "powerDifferenceBp": 824,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000015",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000003"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "powerDifferenceBp": 1540,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000016",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 145,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000017",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000004"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 3311,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "HAND_DISTRIBUTION",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000018",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000006",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "powerDifferenceBp": 3266,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000019",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000001",
          "bbbbbbbb-0000-4000-8000-000000000007"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000004",
          "bbbbbbbb-0000-4000-8000-000000000006"
        ],
        "powerDifferenceBp": 820,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      },
      {
        "gameId": "dddddddd-0000-4000-8000-000000000020",
        "genderCategory": "open",
        "teamA": [
          "bbbbbbbb-0000-4000-8000-000000000002",
          "bbbbbbbb-0000-4000-8000-000000000005"
        ],
        "teamB": [
          "bbbbbbbb-0000-4000-8000-000000000003",
          "bbbbbbbb-0000-4000-8000-000000000008"
        ],
        "powerDifferenceBp": 2591,
        "reasons": [
          "APPEARANCE_BALANCE",
          "PARTNER_DIVERSITY",
          "OPPONENT_DIVERSITY",
          "POWER_BALANCE",
          "GENDER_CATEGORY",
          "LOOKAHEAD_DIVERSITY"
        ]
      }
    ],
    "summary": {
      "targetGameCount": 20,
      "schedulingBatchCount": 20,
      "assignedGameCount": 20,
      "eligibleParticipantCount": 8,
      "appearanceMin": 10,
      "appearanceMax": 10,
      "appearanceSpread": 0,
      "maxConsecutiveStreak": 2,
      "distinctPartnerPairs": 28,
      "maxPartnerRepeat": 3,
      "distinctOpponentPairs": 28,
      "maxOpponentRepeat": 5,
      "averagePowerDifferenceBp": 1365,
      "maxPowerDifferenceBp": 3311,
      "relaxedConstraintCount": 0
    },
    "warnings": [
      {
        "code": "POWER_TOLERANCE_APPLIED",
        "evidence": {
          "epsilonBp": 2000,
          "maxObservedDiffBp": 3311
        }
      },
      {
        "code": "REPEAT_LIMIT_RELAXED",
        "evidence": {
          "partnerConfiguredLimit": 1,
          "partnerMaxObserved": 3,
          "partnerExceededPairCount": 9,
          "opponentConfiguredLimit": 1,
          "opponentMaxObserved": 5,
          "opponentExceededPairCount": 23,
          "defaultLimitApplied": 1
        }
      }
    ],
    "resultHash": "b2aed40aa54025422331048f524108bb24de7a4fd14d58d3feee1545e0d53b33",
    "config": {
      "version": 1,
      "slot_mode": "none",
      "court_count": null,
      "rest_gap_minutes": null,
      "max_games_per_member": null,
      "partner_repeat_limit": null,
      "opponent_repeat_limit": null,
      "consecutive_games_limit": null,
      "review_required": false,
      "attendance_enabled": false,
      "live_queue_enabled": false,
      "pre_scheduling_enabled": false,
      "auto_generation_enabled": true,
      "court_assignment_enabled": false,
      "participant_confirmation_required": false,
      "algorithmVersion": "v1",
      "powerEpsilonBp": 2000,
      "candidateTopK": 8,
      "beamWidth": 32,
      "lookaheadDepth": 2,
      "doublesOnly": true,
      "calculationYear": 2026
    },
    "input": {
      "event": {
        "id": "eeeeeeee-0000-4000-8000-000000000001",
        "clubId": "eeeeeeee-0000-4000-8000-000000000002",
        "status": "active"
      },
      "participants": [
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000001",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000001",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2000,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 1,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000002",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000002",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2001,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 2,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000003",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000003",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2002,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 3,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000004",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000004",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2003,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 4,
          "mapoScoreSource": "member",
          "wins": 3,
          "losses": 4,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000005",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000005",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2004,
          "tennisStartYearSource": "member",
          "dominantHand": "left",
          "dominantHandSource": "member",
          "mapoScore": 5,
          "mapoScoreSource": "member",
          "wins": 4,
          "losses": 3,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000006",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000006",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2005,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 6,
          "mapoScoreSource": "member",
          "wins": 0,
          "losses": 2,
          "draws": 0
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000007",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000007",
          "guestId": null,
          "gender": "male",
          "genderSource": "member",
          "tennisStartYear": 2006,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 7,
          "mapoScoreSource": "member",
          "wins": 1,
          "losses": 1,
          "draws": 1
        },
        {
          "id": "bbbbbbbb-0000-4000-8000-000000000008",
          "participantType": "member",
          "memberId": "cccccccc-0000-4000-8000-000000000008",
          "guestId": null,
          "gender": "female",
          "genderSource": "member",
          "tennisStartYear": 2007,
          "tennisStartYearSource": "member",
          "dominantHand": "right",
          "dominantHandSource": "member",
          "mapoScore": 8,
          "mapoScoreSource": "member",
          "wins": 2,
          "losses": 0,
          "draws": 0
        }
      ],
      "targetGames": [
        {
          "id": "dddddddd-0000-4000-8000-000000000001",
          "position": 1,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000002",
          "position": 2,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000003",
          "position": 3,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000004",
          "position": 4,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000005",
          "position": 5,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000006",
          "position": 6,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000007",
          "position": 7,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000008",
          "position": 8,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000009",
          "position": 9,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000010",
          "position": 10,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000011",
          "position": 11,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000012",
          "position": 12,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000013",
          "position": 13,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000014",
          "position": 14,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000015",
          "position": 15,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000016",
          "position": 16,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000017",
          "position": 17,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000018",
          "position": 18,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000019",
          "position": 19,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        },
        {
          "id": "dddddddd-0000-4000-8000-000000000020",
          "position": 20,
          "format": "doubles",
          "genderCategory": "open",
          "courtId": null,
          "courtPosition": null,
          "sessionId": null,
          "sessionPosition": null,
          "sessionStartsAt": null,
          "sessionEndsAt": null
        }
      ],
      "baseGames": []
    }
  }
] as const satisfies readonly GoldenCase[];
