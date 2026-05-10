import { z } from "zod";
import {
  Courses,
  Ebooks,
  Rooms,
  RoomBookings,
  CourseEnrollments,
  LessonCompletions,
  LessonSchedules,
  Users,
  UserProfiles,
} from "../../helpers/schema";
import { Selectable } from "kysely";

// No input body required for export, just the header check
export const schema = z.object({});

export type ExportData = {
  courses: Selectable<Courses>[];
  ebooks: Selectable<Ebooks>[];
  rooms: Selectable<Rooms>[];
  roomBookings: (Selectable<RoomBookings> & {
    userName: string;
    roomName: string;
  })[];
  courseEnrollments: (Selectable<CourseEnrollments> & {
    studentName: string;
    studentEmail: string;
  })[];
  lessonCompletions: Selectable<LessonCompletions>[];
  lessonSchedules: Selectable<LessonSchedules>[];
  events: Record<string, unknown>[];
  users: Selectable<Users>[];
  userProfiles: Selectable<UserProfiles>[];
  flattenedEnrollments: Record<string, unknown>[];
};

export type OutputType = {
  data: ExportData;
};
