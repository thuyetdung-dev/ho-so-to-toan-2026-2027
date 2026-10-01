import type {LessonPlan} from '../types';
import {parseLessonText} from './lessonImport';
import {newId} from './ids';
import type {LessonSource} from './lessonSource';
export function createImportedLessonDraft(source:LessonSource, fileName:string, author:{id:string;displayName:string}, metadata:{title:string;topicTitle:string;grade:10|11|12;week:number;periodCount:number}):LessonPlan {
  if(!metadata.title.trim() || !metadata.topicTitle.trim()) throw new Error('Cần nhập tên bài và chủ đề.');
  if(![10,11,12].includes(metadata.grade) || !Number.isInteger(metadata.week) || metadata.week<1 || metadata.week>52 || !Number.isInteger(metadata.periodCount) || metadata.periodCount<1 || metadata.periodCount>100) throw new Error('Khối, tuần hoặc số tiết không hợp lệ.');
  const parsed=parseLessonText(source.text);
  const activities=parsed.recognized && parsed.activities.length ? parsed.activities.map(activity=>({...activity,id:newId('activity')}))
    : [{id:newId('activity'),name:'Hoạt động 1: Nội dung nhập từ tệp',objectives:'',content:source.text,product:'',implementation:''}];
  if(source.originalImageId && source.images[source.originalImageId]) activities[activities.length-1].content += `\n\nẢnh gốc để đối chiếu:\n![Ảnh gốc](img:${source.originalImageId})`;
  const now=new Date().toISOString();
  return {
    id:newId('lp'),teacherId:author.id,teacherName:author.displayName,
    ...metadata,title:metadata.title.trim(),topicTitle:metadata.topicTitle.trim(),classNames:[],
    status:'draft',version:1,contentState:'full',createdAt:now,updatedAt:now,
    teachingStatus:'not_taught',isTaught:false,comments:[],sourceFileName:fileName,images:{...source.images},
    objectivesKnowledge:parsed.recognized ? parsed.objectivesKnowledge : '',
    objectivesCompetence:parsed.recognized ? parsed.objectivesCompetence : '',
    objectivesQualities:parsed.recognized ? parsed.objectivesQualities : '',
    equipment:parsed.recognized ? parsed.equipment : '',
    activities,
    versionHistory:[{version:1,updatedAt:now,updatedBy:author.displayName,changeSummary:`Nhập giáo án từ ${fileName}`,status:'draft'}],
  };
}
