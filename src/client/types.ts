/**
 * LinkedIn API Response Types
 *
 * TypeScript definitions for LinkedIn's REST/Voyager API responses.
 * These are the internal API shapes used by LinkedIn's web app.
 */

// ─── Common Types ─────────────────────────────────────────

export interface LinkedInApiResponse<T = unknown> {
  data?: T;
  included?: LinkedInEntity[];
  paging?: LinkedInPaging;
}

export interface LinkedInPaging {
  count: number;
  start: number;
  total?: number;
  links?: Array<{ rel: string; href: string }>;
}

export interface LinkedInEntity {
  $type: string;
  entityUrn?: string;
  [key: string]: unknown;
}

// ─── Profile Types ────────────────────────────────────────

export interface VoyagerProfile {
  $type: string;
  entityUrn: string;
  publicIdentifier: string;
  firstName: string;
  lastName: string;
  headline?: string;
  summary?: string;
  locationName?: string;
  industryName?: string;
  geoLocationName?: string;
  profilePicture?: {
    displayImageReference?: {
      vectorImage?: {
        rootUrl: string;
        artifacts: Array<{
          width: number;
          height: number;
          fileIdentifyingUrlPathSegment: string;
        }>;
      };
    };
  };
  miniProfile?: VoyagerMiniProfile;
}

export interface VoyagerMiniProfile {
  $type: string;
  entityUrn: string;
  publicIdentifier: string;
  firstName: string;
  lastName: string;
  occupation?: string;
  objectUrn?: string;
  trackingId?: string;
  backgroundImage?: VoyagerImage;
  picture?: VoyagerImage;
}

export interface VoyagerImage {
  'com.linkedin.common.VectorImage'?: {
    rootUrl: string;
    artifacts: Array<{
      width: number;
      height: number;
      fileIdentifyingUrlPathSegment: string;
    }>;
  };
}

// ─── Experience Types ─────────────────────────────────────

export interface VoyagerPosition {
  $type: string;
  entityUrn: string;
  companyName?: string;
  title?: string;
  locationName?: string;
  description?: string;
  timePeriod?: VoyagerTimePeriod;
  company?: {
    entityUrn?: string;
    miniCompany?: VoyagerMiniCompany;
  };
}

export interface VoyagerTimePeriod {
  startDate?: { month?: number; year: number };
  endDate?: { month?: number; year: number };
}

// ─── Education Types ──────────────────────────────────────

export interface VoyagerEducation {
  $type: string;
  entityUrn: string;
  schoolName?: string;
  degreeName?: string;
  fieldOfStudy?: string;
  timePeriod?: VoyagerTimePeriod;
  school?: {
    entityUrn?: string;
    schoolName?: string;
    logo?: VoyagerImage;
  };
}

// ─── Skill Types ──────────────────────────────────────────

export interface VoyagerSkill {
  $type: string;
  entityUrn: string;
  name: string;
  multiLocaleSkillName?: Record<string, string>;
}

// ─── Company Types ────────────────────────────────────────

export interface VoyagerMiniCompany {
  $type: string;
  entityUrn: string;
  name: string;
  universalName?: string;
  logo?: VoyagerImage;
  active?: boolean;
}

export interface VoyagerCompany {
  $type: string;
  entityUrn: string;
  name: string;
  universalName: string;
  tagline?: string;
  description?: string;
  industryName?: string;
  staffCount?: number;
  staffCountRange?: { start: number; end?: number };
  headquarter?: {
    city?: string;
    country?: string;
    geographicArea?: string;
    postalCode?: string;
    line1?: string;
  };
  websiteUrl?: string;
  followingInfo?: {
    followerCount?: number;
    following?: boolean;
  };
  logo?: VoyagerImage;
  backgroundCoverImage?: VoyagerImage;
  companyPageUrl?: string;
}

// ─── Job Types ────────────────────────────────────────────

export interface VoyagerJob {
  $type: string;
  entityUrn: string;
  title: string;
  companyDetails?: {
    company?: string; // URN reference
    companyResolutionResult?: VoyagerMiniCompany;
  };
  formattedLocation?: string;
  listedAt?: number; // timestamp
  description?: {
    text?: string;
  };
  applyMethod?: {
    $type: string;
    companyApplyUrl?: string;
    easyApplyUrl?: string;
  };
  workplaceType?: string;
  workRemoteAllowed?: boolean;
}

// ─── Messaging Types ─────────────────────────────────────

export interface VoyagerConversation {
  $type: string;
  entityUrn: string;
  lastActivityAt?: number;
  read?: boolean;
  totalEventCount?: number;
  unreadCount?: number;
  participants?: Array<{
    participantType?: {
      member?: {
        entityUrn: string;
        miniProfile?: VoyagerMiniProfile;
      };
    };
  }>;
  events?: VoyagerMessage[];
}

export interface VoyagerMessage {
  $type: string;
  entityUrn: string;
  createdAt?: number;
  subtype?: string;
  body?: {
    text?: string;
  };
  from?: {
    entityUrn: string;
    miniProfile?: VoyagerMiniProfile;
  };
}

// ─── Feed Types ──────────────────────────────────────────

export interface VoyagerFeedUpdate {
  $type: string;
  entityUrn: string;
  actor?: {
    name?: { text: string };
    description?: { text: string };
    image?: VoyagerImage;
  };
  commentary?: {
    text?: { text: string };
  };
  content?: {
    $type: string;
    [key: string]: unknown;
  };
  socialDetail?: {
    totalSocialActivityCounts?: {
      numLikes?: number;
      numComments?: number;
      numShares?: number;
    };
    liked?: boolean;
  };
  publishedAt?: number;
}

// ─── Network Types ────────────────────────────────────────

export interface VoyagerInvitation {
  $type: string;
  entityUrn: string;
  invitationType?: string;
  message?: string;
  sentTime?: number;
  toMember?: VoyagerMiniProfile;
  fromMember?: VoyagerMiniProfile;
  invitationState?: string;
}

export interface VoyagerConnection {
  $type: string;
  entityUrn: string;
  connectedMember?: string; // URN
  connectedMemberResolutionResult?: VoyagerMiniProfile;
  createdAt?: number;
}

// ─── Search Types ─────────────────────────────────────────

export interface VoyagerSearchResult {
  $type: string;
  entityUrn: string;
  title?: { text: string };
  primarySubtitle?: { text: string };
  secondarySubtitle?: { text: string };
  summary?: { text: string };
  image?: VoyagerImage;
  trackingUrn?: string;
  targetPageUrl?: string;
  navigationUrl?: string;
}

// ─── Notification Types ──────────────────────────────────

export interface VoyagerNotification {
  $type: string;
  entityUrn: string;
  headline?: { text: string };
  notificationText?: { text: string };
  createdAt?: number;
  read?: boolean;
  actor?: VoyagerMiniProfile;
}
