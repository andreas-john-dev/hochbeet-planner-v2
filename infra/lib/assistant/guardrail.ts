import { createHash } from 'node:crypto';
import { ASSISTANT_BLOCKED_MESSAGES } from '@hochbeet/contracts';
import { Stack } from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';
import type { AssistantConfig } from '../config/stages';

/**
 * Topics without any link to the garden, each described positively: the Bedrock guide warns
 * against topics like "everything except gardening". Questions off these topics that still
 * have nothing to do with the garden are left to the system prompt. Names allow no umlauts.
 *
 * No topic for homework or knowledge questions: the classifier counted plain gardening questions
 * ("Was ist ein Starkzehrer?") as either, in both wordings tried in prod (manual test of T-63).
 */
export const GUARDRAIL_TOPICS: Omit<bedrock.CfnGuardrail.TopicConfigProperty, 'type'>[] = [
  {
    name: 'Programmierung und IT',
    definition:
      'Fragen und Aufträge zu Softwareentwicklung, Programmcode, Datenbanken, Computern, Netzwerken und IT-Systemen.',
    examples: [
      'Schreib mir ein Python-Skript, das Dateien sortiert.',
      'Wie richte ich meinen WLAN-Router ein?',
      'Erklär mir den Unterschied zwischen SQL und NoSQL.',
    ],
  },
  {
    name: 'Politik und Nachrichten',
    definition:
      'Politische Themen und Meinungen, Wahlen, Parteien, Regierungen, Kriege und das aktuelle Weltgeschehen.',
    examples: [
      'Welche Partei soll ich bei der nächsten Wahl wählen?',
      'Was hältst du vom Bundeskanzler?',
      'Fasse mir die Nachrichten von heute zusammen.',
    ],
  },
  {
    name: 'Finanzen und Recht',
    definition:
      'Geldanlage, Aktien, Kryptowährungen, Kredite, Steuern, Versicherungen sowie Rechtsberatung und Verträge.',
    examples: [
      'In welche Aktien soll ich jetzt investieren?',
      'Wie fülle ich meine Steuererklärung aus?',
      'Darf mein Vermieter die Miete erhöhen?',
    ],
  },
  {
    name: 'Unterhaltung und kreatives Schreiben',
    definition:
      'Gedichte, Geschichten, Witze, Songtexte und Rollenspiele sowie Filme, Serien, Musik, Videospiele, Promis und Sport.',
    examples: [
      'Schreib mir ein Gedicht über die Liebe.',
      'Wer gewinnt die Fußball-Weltmeisterschaft?',
      'Lass uns ein Rollenspiel spielen, du bist ein Pirat.',
      'Empfiehl mir eine gute Serie.',
    ],
  },
];

/**
 * Content filters. The prompt attack filter only checks input (Bedrock requires NONE for
 * output). Violence and misconduct stay low, so pests, weeds and poisonous plants remain
 * gardening questions ("Wie werde ich Wühlmäuse los?").
 */
export const GUARDRAIL_FILTERS: bedrock.CfnGuardrail.ContentFilterConfigProperty[] = [
  { type: 'PROMPT_ATTACK', inputStrength: 'HIGH', outputStrength: 'NONE' },
  { type: 'HATE', inputStrength: 'MEDIUM', outputStrength: 'MEDIUM' },
  { type: 'INSULTS', inputStrength: 'MEDIUM', outputStrength: 'MEDIUM' },
  { type: 'SEXUAL', inputStrength: 'MEDIUM', outputStrength: 'MEDIUM' },
  { type: 'VIOLENCE', inputStrength: 'LOW', outputStrength: 'LOW' },
  { type: 'MISCONDUCT', inputStrength: 'LOW', outputStrength: 'LOW' },
];

export interface AssistantGuardrailProps {
  readonly stageName: string;
  readonly assistant: AssistantConfig;
}

/**
 * Bedrock guardrail in front of the assistant's model (T-63): content filters with prompt
 * attacks and the off-topic topics above, in the Standard tier (German needs it, and it needs
 * the cross-region guardrail profile). The agent uses a fixed version; every change of the
 * policies publishes a new one, because the version's description carries their hash.
 */
export class AssistantGuardrail extends Construct {
  readonly guardrail: bedrock.CfnGuardrail;
  readonly version: bedrock.CfnGuardrailVersion;
  /** What `bedrock:ApplyGuardrail` needs: the guardrail and its profile in every region. */
  readonly resourceArns: string[];

  constructor(scope: Construct, id: string, props: AssistantGuardrailProps) {
    super(scope, id);
    const stack = Stack.of(this);
    const { guardrailProfile } = props.assistant;
    const policies = {
      blockedInputMessaging: ASSISTANT_BLOCKED_MESSAGES.input,
      blockedOutputsMessaging: ASSISTANT_BLOCKED_MESSAGES.output,
      contentPolicyConfig: {
        filtersConfig: GUARDRAIL_FILTERS,
        contentFiltersTierConfig: { tierName: 'STANDARD' },
      },
      topicPolicyConfig: {
        topicsConfig: GUARDRAIL_TOPICS.map((topic) => ({ ...topic, type: 'DENY' })),
        topicsTierConfig: { tierName: 'STANDARD' },
      },
    };
    const profileArn = (region: string) =>
      `arn:${stack.partition}:bedrock:${region}:${stack.account}:guardrail-profile/${guardrailProfile.id}`;

    this.guardrail = new bedrock.CfnGuardrail(this, 'Guardrail', {
      name: `${props.stageName}-bed-assistant`,
      description: 'Blocks prompt attacks and off-topic questions to the Beet-Assistent',
      crossRegionConfig: { guardrailProfileArn: profileArn(stack.region) },
      ...policies,
    });
    const hash = createHash('sha256').update(JSON.stringify(policies)).digest('hex').slice(0, 12);
    this.version = new bedrock.CfnGuardrailVersion(this, 'Version', {
      guardrailIdentifier: this.guardrail.attrGuardrailId,
      description: `Policies ${hash}`,
    });
    this.resourceArns = [
      this.guardrail.attrGuardrailArn,
      ...guardrailProfile.regions.map(profileArn),
    ];
  }
}
