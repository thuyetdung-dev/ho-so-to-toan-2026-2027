import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v2 as cloudinary } from 'cloudinary';
import { ImageApiError, authorizeImageRequest, authorizeImagePlan, validateIds, readImageDocument, cloudinaryEnvironment, imageCleanupTicket, verifyImageCleanupTicket, imageApiFailure } from '../server/lessonImageAccess.ts';
export default async function handler(req: VercelRequest,res: VercelResponse) {
  res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method !== 'POST') return res.status(405).json({error:'Chỉ chấp nhận POST.'});
  try {
    const actor = await authorizeImageRequest(req);
    const {action,planId,imageId,publicId,cleanupToken,deletePlan} = req.body || {};
    if (action === 'prepare') {
      validateIds(planId,imageId);
      await authorizeImagePlan(actor,planId,{deletePlan:deletePlan === true});
      const meta = await readImageDocument(actor,'lessonPlanImages',`${planId}__${imageId}`);
      if (!meta || meta.provider !== 'cloudinary' || meta.planId !== planId || meta.imageId !== imageId || meta.publicId !== publicId)
        throw new ImageApiError(403,'Ảnh không thuộc giáo án yêu cầu.');
      return res.status(200).json({cleanupToken:await imageCleanupTicket(actor,planId,imageId,publicId)});
    }
    const claim = await verifyImageCleanupTicket(actor,cleanupToken,publicId);
    const [meta,plan] = await Promise.all([
      readImageDocument(actor,'lessonPlanImages',`${claim.planId}__${claim.imageId}`),
      readImageDocument(actor,'lessonPlans',claim.planId),
    ]);
    // A ticket never permits deleting an object that is still referenced by live metadata.
    if (meta?.publicId === claim.publicId) throw new ImageApiError(409,'Ảnh vẫn đang được hồ sơ sử dụng; chưa được xóa.');
    // For an existing plan, re-check role/ownership/state after the database commit.
    if (plan) await authorizeImagePlan(actor,claim.planId);
    const {cloudName,apiKey,apiSecret} = cloudinaryEnvironment();
    cloudinary.config({cloud_name:cloudName,api_key:apiKey,api_secret:apiSecret,secure:true});
    const result = await cloudinary.uploader.destroy(claim.publicId,{resource_type:'image',invalidate:true});
    if (!['ok','not found'].includes(result.result)) throw new ImageApiError(502,'Cloudinary chưa xóa được ảnh.');
    return res.status(200).json({ok:true,result:result.result});
  } catch (error) { return imageApiFailure(res,error); }
}
