import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://lidptdtnsvulvjdwkwvz.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '...'; // I will get it from another file

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase.rpc('run_sql', { sql: `
        CREATE OR REPLACE FUNCTION update_salon_rating()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                UPDATE salons
                SET 
                    review_count = (SELECT count(*) FROM reviews WHERE salon_id = NEW.salon_id),
                    rating = (SELECT round(avg(rating)::numeric, 1) FROM reviews WHERE salon_id = NEW.salon_id)
                WHERE id = NEW.salon_id;
            ELSIF TG_OP = 'UPDATE' THEN
                UPDATE salons
                SET 
                    rating = (SELECT round(avg(rating)::numeric, 1) FROM reviews WHERE salon_id = NEW.salon_id)
                WHERE id = NEW.salon_id;
            ELSIF TG_OP = 'DELETE' THEN
                UPDATE salons
                SET 
                    review_count = (SELECT count(*) FROM reviews WHERE salon_id = OLD.salon_id),
                    rating = (SELECT COALESCE(round(avg(rating)::numeric, 1), 0) FROM reviews WHERE salon_id = OLD.salon_id)
                WHERE id = OLD.salon_id;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_update_salon_rating ON reviews;
        CREATE TRIGGER trg_update_salon_rating
        AFTER INSERT OR UPDATE OR DELETE ON reviews
        FOR EACH ROW EXECUTE FUNCTION update_salon_rating();
    ` });
    console.log("data", data, "error", error);
}
main();
