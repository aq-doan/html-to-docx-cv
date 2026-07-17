/**
 * Assembles the copy-paste "prompt pack" for tailoring the active document with
 * any chat LLM: template contract + base HTML + job/company inputs + output rules.
 */
import contract from '../TEMPLATE-CONTRACT.md?raw';

export interface PromptInputs {
  docType: 'cv' | 'cover-letter';
  baseHtml: string;
  jobUrl?: string;
  jobText?: string;
  companyUrl?: string;
  notes?: string;
}

export function buildPrompt(inputs: PromptInputs): string {
  const docName = inputs.docType === 'cv' ? 'CV' : 'cover letter';
  const parts: string[] = [];

  parts.push(
    `You are an expert technical recruiter and resume writer. Tailor the ${docName} below to the target job. ` +
      `The document is written in a strict HTML template vocabulary that converts 1:1 to a styled Word document — ` +
      `you MUST follow the template contract exactly.`,
  );

  parts.push(`## Template contract\n\n${contract.trim()}`);

  parts.push(`## Base ${docName} (HTML, in the template vocabulary)\n\n\`\`\`html\n${inputs.baseHtml.trim()}\n\`\`\``);

  const target: string[] = [];
  if (inputs.jobUrl) target.push(`Job ad URL: ${inputs.jobUrl}\n(If you can browse, read it; otherwise rely on the pasted description below.)`);
  if (inputs.jobText) target.push(`Job description (pasted):\n\n${inputs.jobText.trim()}`);
  if (inputs.companyUrl) target.push(`Company website: ${inputs.companyUrl}`);
  if (inputs.notes) target.push(`Additional notes from the candidate:\n\n${inputs.notes.trim()}`);
  parts.push(`## Target job\n\n${target.length > 0 ? target.join('\n\n') : '(no job details provided — improve wording and impact only)'}`);

  parts.push(
    `## Your task\n\n` +
      `1. Analyse the job requirements and the company context.\n` +
      `2. Rewrite the ${docName} to emphasise the most relevant experience, skills, and keywords for this role: ` +
      `reorder bullets and sections, reword for impact, trim what is irrelevant.\n` +
      `3. NEVER invent facts: no new employers, roles, dates, projects, certifications, or metrics. ` +
      `Keep the header contact block exactly as it appears in the base document.\n` +
      `4. Use ONLY the template-contract constructs — no other tags, classes, or inline styles.\n` +
      `5. Reply with exactly one fenced \`\`\`html code block containing the complete tailored document, and nothing else.`,
  );

  return parts.join('\n\n---\n\n');
}
