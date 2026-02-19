import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType } from "./list_GET.schema";
import { supabaseAdmin } from "../../helpers/supabaseServer";

const orderedEbookLinks = [
  "https://drive.google.com/file/d/161qr5Le9QUn_TaB3RGWeWEGLOhBM-u_r/view?usp=drive_link",
  "https://drive.google.com/file/d/1UWl48BPet3P6GdN9MyxBMHfr9yCDN8K5/view?usp=drive_link",
  "https://drive.google.com/file/d/1HbHh39duXPRaHdg0DcmEcCPvMHDNaHcL/view?usp=drive_link",
  "https://drive.google.com/file/d/1q8z50bCissHMCegmVg-QXnrLCFjCZs53/view?usp=drive_link",
  "https://drive.google.com/file/d/1IirRh5Rs8SlOO4NIB0yi02gv3M09BZaD/view?usp=drive_link",
  "https://drive.google.com/file/d/1iWQPll_P1VT3Rtos-MTkwcPP1GHBKaMG/view?usp=drive_link",
  "https://drive.google.com/file/d/1hxHELh9eBGgFVC_Ksyx2sHKmP78__vWF/view?usp=drive_link",
  "https://drive.google.com/file/d/1FfYtCPA5sX25fp51c-M5zswXmtdRTzvJ/view?usp=drive_link",
  "https://drive.google.com/file/d/1LTX6jfHmX6lnO6LTps6ocAAd2f8IiKyz/view?usp=drive_link",
  "https://drive.google.com/file/d/1VMlIhFOJ2MK7Pt6esdEJpvf22fWuMMma/view?usp=drive_link",
  "https://drive.google.com/file/d/1AyINHC7I3aqR8o2NooIaEuUfXTdSfi2c/view?usp=drive_link",
  "https://drive.google.com/file/d/1szF0laTSgjENv1WGXRQw6bC2W_UoUSfi/view?usp=drive_link",
  "https://drive.google.com/file/d/1gkdCxt6O9EDNrsbrjm_GY5xczm5cIsYQ/view?usp=drive_link",
  "https://drive.google.com/file/d/15VyzWtEOALjx5mfu-Yv50so6g6Z8fUN7/view?usp=drive_link",
  "https://drive.google.com/file/d/1339VfTCqY62bRuOZMqQ9PwZJOtk20FBR/view?usp=drive_link",
  "https://drive.google.com/file/d/1tJHhA3fJSnNkxEX24yAgcwDMMowAD1XN/view?usp=drive_link",
  "https://docs.google.com/document/d/1O-Iu4z3rvc94w5F6fkDwERw6Z79G5V9d/edit?usp=drive_link&ouid=109745014509333769352&rtpof=true&sd=true",
];

const fallbackEbooks: OutputType["ebooks"] = orderedEbookLinks.map(
  (fileUrl, index) => ({
    id: -(index + 1),
    title: `E-book ${index + 1}`,
    titleVi: `E-book ${index + 1}`,
    description: `DJ learning material #${index + 1}`,
    descriptionVi: `Tài liệu học DJ #${index + 1}`,
    coverImageUrl: null,
    fileUrl,
    courseId: null,
    sortOrder: index,
    courseName: null,
    isUnlocked: false,
  })
);

function isSchemaError(error: any): boolean {
  const message = String(error?.message ?? "");
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    error?.code === "42P01" ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

function readField<T = unknown>(row: Record<string, any>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key] as T;
  }
  return undefined;
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    let ebooks: any[] = [];
    {
      const { data, error } = await supabaseAdmin
        .from("ebooks")
        .select("*")
        .eq("isActive", true)
        .order("courseId", { ascending: true })
        .order("sortOrder", { ascending: true });
      if (error) {
        console.error("Error loading ebooks:", error);
        return new Response(
          superjson.stringify({ ebooks: fallbackEbooks } satisfies OutputType)
        );
      }
      ebooks = data ?? [];
    }

    let enrollments: any[] = [];
    {
      let { data, error } = await supabaseAdmin
        .from("courseEnrollments")
        .select("id,courseId,userId,status")
        .eq("userId", user.id as any)
        .in("status", ["active", "completed"]);
      if (error && isSchemaError(error)) {
        const snake = await supabaseAdmin
          .from("course_enrollments")
          .select("id,course_id,user_id,status")
          .eq("user_id", user.id as any)
          .in("status", ["active", "completed"]);
        if (!snake.error) {
          data = (snake.data ?? []).map((e: any) => ({
            id: e.id,
            courseId: e.course_id,
            userId: e.user_id,
            status: e.status,
          }));
          error = null;
        }
      }
      if (error) throw error;
      enrollments = data ?? [];
    }

    const enrollmentIds = enrollments.map((e: any) => e.id);

    let lessonCompletions: any[] = [];
    if (enrollmentIds.length > 0) {
      let { data, error } = await supabaseAdmin
        .from("lessonCompletions")
        .select("enrollmentId,lessonNumber")
        .in("enrollmentId", enrollmentIds as any);
      if (error && isSchemaError(error)) {
        const snake = await supabaseAdmin
          .from("lesson_completions")
          .select("enrollment_id,lesson_number")
          .in("enrollment_id", enrollmentIds as any);
        if (!snake.error) {
          data = (snake.data ?? []).map((r: any) => ({
            enrollmentId: r.enrollment_id,
            lessonNumber: r.lesson_number,
          }));
          error = null;
        }
      }
      if (error) throw error;
      lessonCompletions = data ?? [];
    }

    const completedLessonNumbers = new Set(
      lessonCompletions.map((lc: any) => Number(lc.lessonNumber))
    );

    let lessonSchedules: any[] = [];
    if (enrollmentIds.length > 0) {
      let { data, error } = await supabaseAdmin
        .from("lessonSchedules")
        .select("enrollmentId,lessonNumber,scheduledAt")
        .in("enrollmentId", enrollmentIds as any);
      if (error && isSchemaError(error)) {
        const snake = await supabaseAdmin
          .from("lesson_schedules")
          .select("enrollment_id,lesson_number,scheduled_at")
          .in("enrollment_id", enrollmentIds as any);
        if (!snake.error) {
          data = (snake.data ?? []).map((r: any) => ({
            enrollmentId: r.enrollment_id,
            lessonNumber: r.lesson_number,
            scheduledAt: r.scheduled_at,
          }));
          error = null;
        }
      }
      if (error) throw error;
      lessonSchedules = data ?? [];
    }

    const oneHourMs = 60 * 60 * 1000;
    const nowMs = Date.now();
    const unlockedByScheduleLessonNumbers = new Set(
      lessonSchedules
        .filter(
          (ls: any) =>
            new Date(ls.scheduledAt).getTime() + oneHourMs <= nowMs
        )
        .map((ls: any) => Number(ls.lessonNumber))
    );

    const courseIds = Array.from(
      new Set(
        ebooks
          .map((e: any) => readField(e, "courseId", "course_id"))
          .filter((v) => v !== null && v !== undefined)
      )
    );
    const courseNameMap = new Map<string, string>();
    if (courseIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("courses")
        .select("id,name")
        .in("id", courseIds as any);
      if (!error) {
        for (const c of data ?? []) {
          courseNameMap.set(String(c.id), c.name);
        }
      }
    }

    const resultEbooks = ebooks.map((ebook: any) => {
      const courseId = readField<number | string | null>(
        ebook,
        "courseId",
        "course_id"
      );
      const sortOrder = Number(readField(ebook, "sortOrder", "sort_order") ?? 0);
      let isUnlocked = false;

      isUnlocked =
        completedLessonNumbers.has(sortOrder) ||
        unlockedByScheduleLessonNumbers.has(sortOrder);

      return {
        id: Number(readField(ebook, "id") ?? 0),
        title: String(readField(ebook, "title") ?? ""),
        titleVi: readField<string | null>(ebook, "titleVi", "title_vi") ?? null,
        description:
          readField<string | null>(ebook, "description") ?? null,
        descriptionVi:
          readField<string | null>(ebook, "descriptionVi", "description_vi") ??
          null,
        coverImageUrl:
          readField<string | null>(ebook, "coverImageUrl", "cover_image_url") ??
          null,
        fileUrl: readField<string | null>(ebook, "fileUrl", "file_url") ?? null,
        courseId: (courseId as any) ?? null,
        sortOrder,
        courseName:
          courseId !== null && courseId !== undefined
            ? courseNameMap.get(String(courseId)) ?? null
            : null,
        isUnlocked,
      };
    });

    return new Response(
      superjson.stringify({
        ebooks: resultEbooks.length > 0 ? resultEbooks : fallbackEbooks,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error listing ebooks:", error);
    return new Response(
      superjson.stringify({ ebooks: fallbackEbooks } satisfies OutputType)
    );
  }
}
