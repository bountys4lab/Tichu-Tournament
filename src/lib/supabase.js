import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mzgainuybnycpbgxqoog.supabase.co";

const supabaseKey = "sb_publishable_iQ2uR8_5_RBbCWoUEOKXOg_MM_-cwhu";

export const supabase = createClient(supabaseUrl, supabaseKey);