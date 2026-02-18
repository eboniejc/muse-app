import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";
import { OutputType } from "./list_GET.schema";

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

function isSchemaOrMissingTableError(error: unknown): boolean {
  const maybeErr = error as { code?: string; message?: string } | null;
  if (!maybeErr) return false;
  return (
    maybeErr.code === "42703" ||
    maybeErr.code === "42P01" ||
    maybeErr.code === "PGRST205" ||
    maybeErr.message?.includes("does not exist") === true ||
    maybeErr.message?.includes("schema cache") === true
  );
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    // Fetch ebooks and join with courses to get course name
    const ebooks = await db
      .selectFrom("ebooks")
      .leftJoin("courses", "ebooks.courseId", "courses.id")
      .select([
        "ebooks.id",
        "ebooks.title",
        "ebooks.titleVi",
        "ebooks.description",
        "ebooks.descriptionVi",
        "ebooks.coverImageUrl",
        "ebooks.fileUrl",
        "ebooks.courseId",
        "ebooks.sortOrder",
        "courses.name as courseName",
      ])
      .where("ebooks.isActive", "=", true)
      .orderBy("ebooks.courseId")
      .orderBy("ebooks.sortOrder")
      .execute();

    // Get user's active or completed enrollments
    const enrollments = await db
      .selectFrom("courseEnrollments")
      .select(["id", "courseId"])
      .where("userId", "=", user.id)
      .where("status", "in", ["active", "completed"])
      .execute();

    const enrollmentIds = enrollments.map((e) => e.id);
    const enrollmentByCourseId = new Map(
      enrollments.map((e) => [e.courseId, e.id])
    );

    // Get lesson completions for these enrollments
    let lessonCompletions: { enrollmentId: number; lessonNumber: number }[] = [];
    if (enrollmentIds.length > 0) {
      lessonCompletions = await db
        .selectFrom("lessonCompletions")
        .select(["enrollmentId", "lessonNumber"])
        .where("enrollmentId", "in", enrollmentIds)
        .execute();
    }

    // Build a set of completed lessons: "enrollmentId-lessonNumber"
    const completedLessonsSet = new Set(
      lessonCompletions.map((lc) => `${lc.enrollmentId}-${lc.lessonNumber}`)
    );

    const resultEbooks = ebooks.map((ebook) => {
      let isUnlocked = false;

      // Unlock only when the corresponding lesson is marked complete.
      // Supports both 0-based and 1-based sort ordering from sheet data.
      const enrollmentId = ebook.courseId
        ? enrollmentByCourseId.get(ebook.courseId)
        : undefined;
      if (enrollmentId) {
        const keySame = `${enrollmentId}-${ebook.sortOrder}`;
        const keyPlusOne = `${enrollmentId}-${ebook.sortOrder + 1}`;
        isUnlocked =
          completedLessonsSet.has(keySame) || completedLessonsSet.has(keyPlusOne);
      }

      return {
        id: ebook.id,
        title: ebook.title,
        titleVi: ebook.titleVi,
        description: ebook.description,
        descriptionVi: ebook.descriptionVi,
        coverImageUrl: ebook.coverImageUrl,
        fileUrl: ebook.fileUrl,
        courseId: ebook.courseId,
        sortOrder: ebook.sortOrder,
        courseName: ebook.courseName,
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
    // Always return locked fallback ebooks so the page still renders even when
    // database/schema configuration is incomplete in production.
    return new Response(
      superjson.stringify({ ebooks: fallbackEbooks } satisfies OutputType)
    );
  }
}
