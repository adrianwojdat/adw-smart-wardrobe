-- Image identity and garment assignment remain immutable; editors may replace pixels.
grant update(path,width,height) on public.garment_images to authenticated;
create policy images_update on public.garment_images for update to authenticated
using(public.has_wardrobe_access(wardrobe_id,true))
with check(public.has_wardrobe_access(wardrobe_id,true)
 and split_part(path,'/',1)=wardrobe_id::text
 and split_part(path,'/',2)=garment_id::text);
notify pgrst,'reload schema';
