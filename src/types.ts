/**
 * Shared type definitions for LinkedIn Pro MCP Server.
 */

/** Transport type for the MCP server */
export type TransportType = 'stdio' | 'http';

/** Server startup configuration */
export interface ServerConfig {
  transport: TransportType;
  port: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/** Standard tool result returned to MCP clients */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** LinkedIn profile data (core fields) */
export interface LinkedInProfile {
  publicIdentifier: string;
  firstName: string;
  lastName: string;
  headline?: string;
  summary?: string;
  location?: string;
  industryName?: string;
  profilePictureUrl?: string;
  connectionDegree?: string;
  connectionsCount?: number;
  experience?: LinkedInExperience[];
  education?: LinkedInEducation[];
  skills?: LinkedInSkill[];
}

export interface LinkedInExperience {
  title: string;
  companyName: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  isCurrent?: boolean;
}

export interface LinkedInEducation {
  schoolName: string;
  degreeName?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
}

export interface LinkedInSkill {
  name: string;
  endorsementCount?: number;
}

/** LinkedIn message thread */
export interface LinkedInConversation {
  conversationId: string;
  participants: string[];
  lastMessage?: string;
  lastActivityAt?: string;
  unreadCount?: number;
}

/** LinkedIn job posting */
export interface LinkedInJob {
  jobId: string;
  title: string;
  companyName: string;
  location?: string;
  postedAt?: string;
  description?: string;
  applicantCount?: number;
  workplaceType?: string;
  seniorityLevel?: string;
}

/** LinkedIn company */
export interface LinkedInCompany {
  universalName: string;
  name: string;
  tagline?: string;
  description?: string;
  industry?: string;
  employeeCount?: number;
  headquarters?: string;
  website?: string;
  followersCount?: number;
}

/** Simple structured logger */
export class Logger {
  private level: number;
  private static readonly LEVELS: Record<string, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(level: string = 'info') {
    this.level = Logger.LEVELS[level] ?? 1;
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    if (this.level <= 0) this.log('DEBUG', msg, data);
  }

  info(msg: string, data?: Record<string, unknown>): void {
    if (this.level <= 1) this.log('INFO', msg, data);
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    if (this.level <= 2) this.log('WARN', msg, data);
  }

  error(msg: string, data?: Record<string, unknown>): void {
    if (this.level <= 3) this.log('ERROR', msg, data);
  }

  private log(level: string, msg: string, data?: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      msg,
      ...data,
    };
    // Use stderr to avoid interfering with stdio transport on stdout
    process.stderr.write(JSON.stringify(entry) + '\n');
  }
}
