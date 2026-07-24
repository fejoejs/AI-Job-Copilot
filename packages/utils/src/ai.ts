import dotenv from 'dotenv';
dotenv.config();

export interface AIServiceConfig {
  apiKey?: string;       // Anthropic Claude
  geminiApiKey?: string; // Google Gemini (Free Backup)
  groqApiKey?: string;   // Groq Llama 3 (Free Backup)
  modelName?: string;
  taskProviders?: { [task: string]: 'anthropic' | 'gemini' | 'groq' };
  onApiCall?: (service: string, model: string, status: 'success' | 'failed', errorMessage?: string) => void;
}

export class AIService {
  private apiKey: string;
  private geminiApiKey: string;
  private groqApiKey: string;
  private model: string;
  private taskProviders: { [task: string]: 'anthropic' | 'gemini' | 'groq' };
  private baseUrl: string = 'https://api.anthropic.com/v1/messages';
  private onApiCall?: (service: string, model: string, status: 'success' | 'failed', errorMessage?: string) => void;

  constructor(config?: AIServiceConfig) {
    this.apiKey = config?.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.geminiApiKey = config?.geminiApiKey || process.env.GEMINI_API_KEY || '';
    this.groqApiKey = config?.groqApiKey || process.env.GROQ_API_KEY || '';
    this.model = config?.modelName || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    this.onApiCall = config?.onApiCall;
    
    console.log('[AIService Constructor] Initialized keys:', {
      hasAnthropic: !!this.apiKey,
      anthropicLen: this.apiKey?.length,
      hasGemini: !!this.geminiApiKey,
      geminiLen: this.geminiApiKey?.length,
      hasGroq: !!this.groqApiKey,
      groqLen: this.groqApiKey?.length,
      configPassed: !!config,
      configKeys: config ? Object.keys(config) : []
    });

    // Default task routing configurations (task-by-task optimized models)
    this.taskProviders = {
      parsing: 'gemini',       // Gemini Flash
      matching: 'gemini',      // Gemini Flash
      tailoring: 'anthropic',  // Claude
      coverLetter: 'anthropic',// Claude
      chat: 'gemini',          // Gemini Flash
      atsFeedback: 'gemini',   // Gemini Flash
      ...(config?.taskProviders || {}),
    };
  }

  /**
   * 1. Helper to execute requests directly against Anthropic Claude API
   */
  private async callClaude(systemPrompt: string, userMessage: string, responseJson = false): Promise<string> {
    if (!this.apiKey) {
      this.onApiCall?.('Anthropic', this.model, 'failed', 'ANTHROPIC_API_KEY is not defined.');
      throw new Error('ANTHROPIC_API_KEY is not defined.');
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4000,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userMessage }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API Error (${response.status}): ${errorText}`);
      }

      const data: any = await response.json();
      const content = data.content?.[0]?.text || '';
      this.onApiCall?.('Anthropic', this.model, 'success');
      return content.trim();
    } catch (error: any) {
      console.error('Claude API call failed:', error);
      this.onApiCall?.('Anthropic', this.model, 'failed', error.message || String(error));
      throw error;
    }
  }

  /**
   * 2. Helper to execute requests directly against Google Gemini API
   */
  private async callGemini(systemPrompt: string, userMessage: string, responseJson = false, usePro = false): Promise<string> {
    const key = this.geminiApiKey;
    if (!key) {
      this.onApiCall?.('Gemini', usePro ? 'gemini-1.5-pro' : 'gemini-1.5-flash', 'failed', 'GEMINI_API_KEY is not defined.');
      throw new Error('GEMINI_API_KEY is not defined.');
    }

    const models = usePro 
      ? ['gemini-1.5-pro', 'gemini-2.0-flash'] 
      : ['gemini-1.5-flash', 'gemini-2.0-flash'];

    let lastError: any = null;

    for (const modelName of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
      try {
        console.log(`[Gemini Request] Attempting call with model: ${modelName}`);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: userMessage }]
              }
            ],
            systemInstruction: systemPrompt ? {
              parts: [{ text: systemPrompt }]
            } : undefined,
            generationConfig: responseJson ? {
              temperature: 0.1,
              responseMimeType: 'application/json'
            } : {
              temperature: 0.2
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API Error (${response.status}) on model ${modelName}: ${errorText}`);
        }

        const data: any = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        this.onApiCall?.('Gemini', modelName, 'success');
        return content.trim();
      } catch (error: any) {
        console.warn(`[Gemini Failed] Model ${modelName} call failed, trying next fallback:`, error.message || error);
        this.onApiCall?.('Gemini', modelName, 'failed', error.message || String(error));
        lastError = error;
      }
    }

    throw lastError || new Error('All Gemini model candidates failed.');
  }

  /**
   * 3. Helper to execute requests directly against Groq Cloud API
   */
  private async callGroq(systemPrompt: string, userMessage: string, responseJson = false): Promise<string> {
    const key = this.groqApiKey;
    const model = 'llama-3.3-70b-versatile';
    if (!key) {
      this.onApiCall?.('Groq', model, 'failed', 'GROQ_API_KEY is not defined.');
      throw new Error('GROQ_API_KEY is not defined.');
    }

    const url = 'https://api.groq.com/openai/v1/chat/completions';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: userMessage }
          ],
          temperature: 0.1,
          response_format: responseJson ? { type: 'json_object' } : undefined
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API Error (${response.status}): ${errorText}`);
      }

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      this.onApiCall?.('Groq', model, 'success');
      return content.trim();
    } catch (error: any) {
      console.error('Groq API call failed:', error);
      this.onApiCall?.('Groq', model, 'failed', error.message || String(error));
      throw error;
    }
  }

  /**
   * Dynamic Routing and Fallback Dispatcher
   */
  public async executeTask(task: string, systemPrompt: string, userMessage: string, responseJson = false): Promise<string> {
    const primaryProvider = this.taskProviders[task] || 'anthropic';
    
    // Define the full priority order. Put primary first, then the fallbacks.
    const priorityOrder = [
      primaryProvider,
      ...['anthropic', 'gemini', 'groq'].filter(p => p !== primaryProvider)
    ];

    let lastError: any = null;

    for (const provider of priorityOrder) {
      try {
        if (provider === 'gemini' && this.geminiApiKey) {
          const usePro = task === 'tailoring' || task === 'coverLetter';
          return await this.callGemini(systemPrompt, userMessage, responseJson, usePro);
        }
        if (provider === 'groq' && this.groqApiKey) {
          return await this.callGroq(systemPrompt, userMessage, responseJson);
        }
        if (provider === 'anthropic' && this.apiKey) {
          return await this.callClaude(systemPrompt, userMessage, responseJson);
        }
      } catch (err: any) {
        console.warn(`[Failover] Provider "${provider}" failed for task "${task}":`, err.message || err);
        lastError = err;
      }
    }

    // 3. No mock/demo mode — require real API keys
    throw lastError || new Error(
      `No operational AI API keys found for task "${task}". ` +
      'Please configure at least one API key (GEMINI_API_KEY, ANTHROPIC_API_KEY, or GROQ_API_KEY) ' +
      'in the Admin panel under AI Model Configuration to use this feature.'
    );
  }

  /**
   * 1. Parses raw resume text into a structured profile JSON
   */
  async parseResume(resumeText: string): Promise<any> {
    const systemPrompt = `
You are an expert resume parsing engine.
Your task is to parse the raw text of a resume into a precise JSON structure.
You MUST output ONLY valid JSON. Do not include markdown formatting like \`\`\`json or trailing text.

CRITICAL INSTRUCTION:
1. Extract ALL contact info, social profile links, and technology keywords. If the resume has a LinkedIn URL, GitHub URL, portfolio/website link, or other project media links, you MUST extract them into the "links" object.
2. You MUST extract EVERY SINGLE technical skill, tool, framework, programming language, and methodology mentioned. Do NOT skip or omit any.
3. Extract certifications (e.g. AWS Certified Solutions Architect, Certified Scrum Master) into a dedicated "certifications" array. You MUST NOT combine or mix certifications or certificates inside the professional summary.

The JSON must follow this structure:
{
  "fullName": "Name",
  "email": "Email",
  "phone": "Phone number",
  "links": {
    "linkedin": "LinkedIn profile URL if present, otherwise empty string",
    "github": "GitHub profile URL if present, otherwise empty string",
    "portfolio": "Portfolio/Website URL if present, otherwise empty string",
    "other": ["Any other social media, project, or general links found in the resume header/text"]
  },
  "skills": ["Skill1", "Skill2"],
  "certifications": ["Cert1", "Cert2"],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "Location",
      "startDate": "Date",
      "endDate": "Date or Present",
      "description": "Short summary",
      "achievements": ["Achievement 1", "Achievement 2"]
    }
  ],
  "education": [
    {
      "degree": "Degree",
      "institution": "School Name",
      "location": "Location",
      "graduationYear": "Year"
    }
  ],
  "projects": [
    {
      "title": "Project Title",
      "description": "What it is",
      "technologies": ["React", "Python"],
      "url": "optional url"
    }
  ],
  "summary": "Short professional summary"
}
`;
    const responseText = await this.executeTask('parsing', systemPrompt, `Resume text:\n${resumeText}`, true);
    return this.cleanAndParseJson(responseText);
  }

  /**
   * 2. Semantic matching logic comparing parsed profile vs Job Description
   */
  async matchJob(profile: any, jobTitle: string, jobDescription: string): Promise<any> {
    const systemPrompt = `
You are an AI Job Matching Engine. Analyze the candidate's parsed resume profile against the job description.
Determine the semantic match score, pro/con points, missing skills, and a recommendation.

CRITICAL REQUIREMENT:
You MUST evaluate the candidate's projects section ("projects" array) in addition to skills and work experience. Pay close attention to the "technologies" list in each project to match technical keywords (e.g. if the job requires React and the candidate has a React project, count it as a matched skill/technology).

You MUST output ONLY valid JSON matching this schema:
{
  "matchScore": 85, // 0 to 100
  "recommendation": "Apply", // "Apply" or "Skip"
  "reasoning": "Detailed explanation of match decision, explicitly mentioning project alignment...",
  "pros": ["Pro point 1", "Pro point 2"],
  "cons": ["Con point 1", "Missing Docker but easy to learn"],
  "missingSkills": ["Docker", "Kubernetes"],
  "decisionScore": 82 // Decision score out of 100 taking into account role alignment
}
`;
    const userMsg = `
CANDIDATE PROFILE:
${JSON.stringify(profile, null, 2)}

JOB TITLE: ${jobTitle}
JOB DESCRIPTION:
${jobDescription}
`;
    const responseText = await this.executeTask('matching', systemPrompt, userMsg, true);
    return this.cleanAndParseJson(responseText);
  }

  /**
   * 3. AI Resume Customization/Tailoring
   */
  async tailorResume(profile: any, jobDescription: string): Promise<any> {
    const systemPrompt = `
You are an AI Resume Customizer. Tailor the candidate's resume profile to match the keyword intent and requirements of the Job Description.
Guidelines:
- Do NOT lie or invent false experience.
- Adjust phrasing (e.g. modify Title to be closer to JD if aligned - like 'Python Developer' to 'Data Engineer using Python' if the experience is database-centric).
- Rearrange skills to highlight matching items.
- Focus achievements to align with JD requirements.
Output ONLY the tailored JSON profile following the exact resume schema.
`;
    const userMsg = `
ORIGINAL PROFILE:
${JSON.stringify(profile, null, 2)}

JOB DESCRIPTION:
${jobDescription}
`;
    const responseText = await this.executeTask('tailoring', systemPrompt, userMsg, true);
    return this.cleanAndParseJson(responseText);
  }

  /**
   * 4. AI Cover Letter Generator
   */
  async generateCoverLetter(profile: any, jobTitle: string, company: string, jobDescription: string): Promise<string> {
    const systemPrompt = `
You are an elite executive career advisor. Write a highly customized, compelling, professional one-page cover letter that matches the candidate's actual qualifications and experiences to the target job description.

Follow these strict rules to ensure relevance and clean output:
1. Start directly with a professional salutation: "Dear Hiring Team at ${company}," or "Dear Hiring Manager,".
2. DO NOT output any header information such as dates, candidate address, phone, email, or company address. 
3. DO NOT include bracketed placeholders like "[Date]", "[Hiring Manager's Name]", "[Your Phone Number]", "[Insert Skills Here]". If you do not have a piece of information, write the cover letter naturally without mentioning it or leaving placeholders.
4. Strictly use the candidate's actual achievements, skills, and experience listed in their profile. DO NOT invent fake past employers, project details, or degrees.
5. Highlight 2-3 specific technical skills or projects from the profile that directly solve pain points outlined in the job description.
6. Keep the tone professional, confident, and engaging.
7. End directly with a professional sign-off: "Sincerely," followed by the candidate's full name.
8. Output ONLY the letter contents. Absolutely no markdown wrappers, intros, or post-letter comments.
`;
    const userMsg = `
Candidate Name: ${profile.fullName || 'Candidate'}
Target Job Title: ${jobTitle}
Company Name: ${company}
Job Description:
${jobDescription}

Candidate Profile:
${JSON.stringify(profile, null, 2)}
    `;
    return this.executeTask('coverLetter', systemPrompt, userMsg, false);
  }

  /**
   * 5. AI-Powered ATS Feedback Generator (feedback text only — scoring is deterministic)
   * Receives the parsed profile + pre-computed rule scores and generates personalized feedback
   */
  async generateAtsFeedback(profile: any, ruleScores: any): Promise<any> {
    const systemPrompt = `
You are an expert ATS (Applicant Tracking System) Resume Advisor for Fortune 500 and MNC recruiters.
You are given a candidate's parsed resume profile and pre-computed ATS compatibility scores.

Your job is ONLY to generate personalized, actionable feedback. Do NOT compute scores — they are already provided.

Based on the resume content and the scores, produce:

1. **feedback**: 4-6 specific, actionable tips referencing ACTUAL content from this resume. Each must have:
   - "type": "critical" | "warning" | "suggestion"
   - "title": short heading (max 8 words)
   - "detail": specific explanation referencing actual resume content (max 40 words)

2. **strengths**: 2-4 specific things this resume does well (reference actual skills, sections, or formatting found)

3. **summary**: A 2-sentence overall assessment of this resume's ATS readiness.

You MUST output ONLY valid JSON matching this exact schema:
{
  "feedback": [
    {
      "type": "critical",
      "title": "Add metrics to experience bullets",
      "detail": "Your Software Engineer role at TechCorp has no quantifiable results. Add percentages, revenue impact, or team sizes."
    }
  ],
  "strengths": ["Strong 12-skill technical section covering Python, React, AWS", "Clean chronological experience layout"],
  "summary": "This resume has solid technical keywords but lacks measurable achievements. Adding metrics to 3-4 bullets would significantly improve ATS pass rates."
}
`;
    const userMsg = `
PARSED RESUME PROFILE:
${JSON.stringify(profile, null, 2)}

PRE-COMPUTED ATS SCORES:
Overall Score: ${ruleScores.overallScore}/100
Format Compatibility: ${ruleScores.formatCompatibility}/100
Keyword Density: ${ruleScores.keywordDensity}/100
Quantifiable Achievements: ${ruleScores.quantifiableAchievements}/100
Section Structure: ${ruleScores.sectionStructure}/100
MNC Compliance: ${ruleScores.mncCompliance}/100
`;
    const responseText = await this.executeTask('atsFeedback', systemPrompt, userMsg, true);
    return this.cleanAndParseJson(responseText);
  }

  private cleanAndParseJson(text: string): any {
    try {
      let cleaned = text.trim();
      
      // First, remove markdown format wrappers if present at the very edges
      cleaned = cleaned.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/i, '').trim();

      // Extract main JSON object or array block if there is STILL surrounding conversational text
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      const arrayStart = cleaned.indexOf('[');
      const arrayEnd = cleaned.lastIndexOf(']');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart && (arrayStart === -1 || jsonStart < arrayStart)) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      } else if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
        cleaned = cleaned.substring(arrayStart, arrayEnd + 1);
      }

      cleaned = cleaned.trim();
      return JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse JSON from AI response:', text);
      throw new Error('AI response was not valid JSON');
    }
  }
}
