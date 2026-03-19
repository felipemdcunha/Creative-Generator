export interface CreativeSet {
  id: string;
  name: string;
  market_vocation: string;
  brand_colors: {
    primary: string;
    secondary: string;
    tertiary: string;
  } | null;
  development_id?: string;
  additional_logo_url?: string;
  organization_id?: string;
  knowledge_base_text?: string; // New: Context for the AI
  visual_references?: string[]; // New: Array of URLs for style reference
}

export interface PersonaData {
  name: string;
  pain_points: string;
  archetype: string;
  job_title: string;
  meta_ads: {
    age_range: string;
    interests: string[];
    gender: string;
    income_level: string;
  };
  base_assets: {
    lp_headline: string;
    lp_bullets: string[];
    sales_slide_argument: string;
  };
}

export interface Persona {
  id: string;
  name: string;
  creative_set_id: string;
  advanced_data: PersonaData;
  avatar_url?: string;
}

// --- META ADS STRUCTURE ---

export interface AdAsset {
  id: string;
  concept_id: string;
  image_url: string;
  fb_image_hash?: string;
  asset_type: 'FEED_IMAGE' | 'STORY_IMAGE';
  aspect_ratio: '1:1' | '9:16' | '4:5' | '16:9';
  prompt_used: string;
  reference_image_url?: string; // URL of the gallery image used as base
  created_at: string;
}

export interface AdConcept {
  id: string;
  development_id?: string;
  persona_id: string;
  organization_id?: string;
  
  internal_name: string;
  url_tags: string;

  primary_text: string; // Max 125 chars
  headline: string;     // Max 40 chars
  description: string;  // Max 30 chars
  call_to_action_type: 'LEARN_MORE' | 'SIGN_UP' | 'GET_OFFER' | 'WHATSAPP_MESSAGE';
  link_url?: string;

  funnel_stage: 'top' | 'middle' | 'bottom';
  status: 'draft' | 'approved' | 'published' | 'archived';
  
  created_at: string;
  ad_assets?: AdAsset[];
}

// --- COMPLEX DIRECTOR OF MARKETING STRUCTURE ---

export interface CreativeIdea {
  selected_amenity_id?: string; // ID chosen by AI from the available list
  creative_concept: {
    angle: string;
    funnel_stage: 'top' | 'middle' | 'bottom';
    target_emotion: string;
    communication_goal: string;
  };
  copy: {
    headline: string; // Max 40
    subheadline_optional?: string;
    body_optional?: string; // Usually primary text, max 125
    cta: string; // Used to map to enum
  };
  visual_prompt: {
    global_style: {
      brand_colors: {
        primary: string;
        secondary: string;
        text: string;
      };
      visual_style_keywords: string[];
      lighting: string;
      mood: string;
      contrast_level: string;
    };
    scene_description: {
      main_subject: string;
      secondary_elements: string[];
      environment: string;
      emotion_expression: string;
    };
    composition_rules: {
      layout_type: string;
      negative_space_for_text: string;
      focus_priority: string[];
      visual_hierarchy_notes: string;
    };
    brand_assets_rules: {
      use_development_logo: boolean;
      use_organization_logo: boolean;
      logo_placement_preference: string;
      logo_constraints: string[];
    };
    reference_images_usage?: {
       mandatory: boolean;
       references: any[];
    };
    format_variations: Array<{
      format: string;
      canvas_ratio: string;
      layout_adjustments: string[];
      text_positioning: string;
      logo_positioning: string;
    }>;
    nano_banana_final_prompt: string;
  };
  quality_rules: string[];
  metadata: {
    used_assets_ids: string[];
    tags: string[];
  };
}

export interface AmenityOption {
  id: string;
  title: string;
}

export interface GenerationConfig {
  funnelStage: 'top' | 'middle' | 'bottom';
  ideaType: 'random' | 'custom';
  customIdeaText?: string;
  includeDevLogo: boolean;
  includeOrgLogo: boolean;
  includeAdditionalLogo: boolean;
  availableAmenities: AmenityOption[];
  formats: ('1:1' | '9:16' | '16:9' | '4:5')[];
  quantity: number;
}

export interface QueueItem {
  id: string;
  type: 'new_concept' | 'regenerate_asset' | 'edit_asset';
  
  config?: GenerationConfig;
  
  sourceAsset?: AdAsset;
  sourceConcept?: AdConcept; 
  editInstruction?: string;
  editReferenceImages?: string[];

  status: 'pending' | 'generating_copy' | 'saving_concept' | 'generating_assets' | 'completed' | 'error';
  
  totalAssets?: number;
  completedAssets?: number;
  
  error?: string;
  resultConcept?: AdConcept;
  generatedIdea?: CreativeIdea;
}

export interface Development {
  id: string;
  name: string;
  logo_url: string;
}

export interface Organization {
  id: string;
  name: string;
  logo_url: string;
}