import { supabaseAdmin } from "../../helpers/supabaseServer";
import superjson from "superjson";
import { OutputType } from "./list_GET.schema";

const csvFallbackCourses: OutputType["courses"] = [
  {
    id: 5,
    name: "Khoá học DJ Cơ Bản",
    description:
      "Basic DJ Course - Learn the fundamentals of DJing including beatmatching, mixing basics, and equipment handling. Perfect for complete beginners.",
    totalLessons: 8,
    maxStudents: 10,
    skillLevel: "Beginner",
    price: "9600000.00",
    isActive: true,
    instructorId: 2,
    instructorName: "DJ Phatbeatz",
    instructorAvatar: null,
    enrolledCount: 0,
  },
  {
    id: 6,
    name: "Khoá học DJ Trung Cấp",
    description:
      "Intermediate DJ Course - Build on your basics with advanced mixing techniques, EQ control, and set building.",
    totalLessons: 10,
    maxStudents: 10,
    skillLevel: "Intermediate",
    price: "12000000.00",
    isActive: true,
    instructorId: 2,
    instructorName: "DJ Phatbeatz",
    instructorAvatar: null,
    enrolledCount: 0,
  },
  {
    id: 7,
    name: "Khoá học DJ Nâng Cao",
    description:
      "Advanced DJ Course - Master advanced techniques including scratching, harmonic mixing, and live performance skills.",
    totalLessons: 12,
    maxStudents: 10,
    skillLevel: "Advanced",
    price: "15000000.00",
    isActive: true,
    instructorId: 2,
    instructorName: "DJ Phatbeatz",
    instructorAvatar: null,
    enrolledCount: 0,
  },
  {
    id: 8,
    name: "Khoá học DJ Cho Trẻ",
    description:
      "DJ Course for Kids - Fun and engaging DJ lessons designed specifically for young aspiring DJs aged 8-15.",
    totalLessons: 6,
    maxStudents: 10,
    skillLevel: "Beginner",
    price: "7200000.00",
    isActive: true,
    instructorId: 2,
    instructorName: "DJ Phatbeatz",
    instructorAvatar: null,
    enrolledCount: 0,
  },
  {
    id: 9,
    name: "Khóa học DJ Toàn Diện",
    description:
      "Comprehensive DJ Course - Complete program covering all aspects from beginner to professional level.",
    totalLessons: 16,
    maxStudents: 10,
    skillLevel: "All Levels",
    price: "25000000.00",
    isActive: true,
    instructorId: 2,
    instructorName: "DJ Phatbeatz",
    instructorAvatar: null,
    enrolledCount: 0,
  },
  {
    id: 10,
    name: "Khoá học DJ Chuyên Sâu HipHop",
    description:
      "Intensive HipHop DJ Course - Focus on HipHop music, scratching, beatjuggling, and turntablism.",
    totalLessons: 8,
    maxStudents: 10,
    skillLevel: "Intermediate",
    price: "12000000.00",
    isActive: true,
    instructorId: 2,
    instructorName: "DJ Phatbeatz",
    instructorAvatar: null,
    enrolledCount: 0,
  },
  {
    id: 11,
    name: "Khoá học DJ Chuyên Sâu EDM",
    description:
      "Intensive EDM DJ Course - Master EDM mixing, effects, build-ups, drops, and festival-style performances.",
    totalLessons: 8,
    maxStudents: 10,
    skillLevel: "Intermediate",
    price: "12000000.00",
    isActive: true,
    instructorId: 2,
    instructorName: "DJ Phatbeatz",
    instructorAvatar: null,
    enrolledCount: 0,
  },
  {
    id: 12,
    name: "Khoá học DJ Chuyên Sâu Techno",
    description:
      "Intensive Techno DJ Course - Deep dive into underground music, layering, cueing, and creating hypnotic sets.",
    totalLessons: 8,
    maxStudents: 10,
    skillLevel: "Intermediate",
    price: "12000000.00",
    isActive: true,
    instructorId: 2,
    instructorName: "DJ Phatbeatz",
    instructorAvatar: null,
    enrolledCount: 0,
  },
];

function isMissingTableError(error: unknown, tableName: string): boolean {
  const maybeErr = error as { code?: string; message?: string } | null;
  if (!maybeErr) return false;
  return (
    maybeErr.code === "PGRST205" &&
    maybeErr.message?.includes(`public.${tableName}`) === true
  );
}

export async function handle(request: Request) {
  try {
    // Public endpoint - fetch active courses with instructor info
    const { data: courses, error: coursesErr } = await supabaseAdmin
      .from('courses')
      .select('id,name,description,totalLessons,maxStudents,skillLevel,price,isActive,instructorId,users(displayname,avatarUrl)')
      .eq('isActive', true);

    if (coursesErr) {
      if (isMissingTableError(coursesErr, "courses")) {
        return new Response(
          superjson.stringify({
            courses: csvFallbackCourses,
          } satisfies OutputType)
        );
      }
      throw coursesErr;
    }

    if (!courses || courses.length === 0) {
      return new Response(
        superjson.stringify({
          courses: csvFallbackCourses,
        } satisfies OutputType)
      );
    }

    // Get enrollment counts for each course
    const { data: enrollmentCounts, error: enrollErr } = await supabaseAdmin
      .from('courseEnrollments')
      .select('courseId')
      .eq('status', 'active');

    if (enrollErr && !isMissingTableError(enrollErr, "courseEnrollments")) {
      throw enrollErr;
    }

    const countMap = new Map<string, number>();
    (enrollmentCounts || []).forEach((e: any) => {
      countMap.set(e.courseId, (countMap.get(e.courseId) || 0) + 1);
    });

    const resultCourses = (courses || []).map((course: any) => ({
      id: course.id,
      name: course.name,
      description: course.description,
      totalLessons: course.totalLessons,
      maxStudents: course.maxStudents,
      skillLevel: course.skillLevel,
      price: course.price ? String(course.price) : null,
      isActive: course.isActive,
      instructorId: course.instructorId,
      instructorName: course.users?.displayname || null,
      instructorAvatar: course.users?.avatarUrl || null,
      enrolledCount: countMap.get(course.id) || 0,
    }));

    return new Response(
      superjson.stringify({
        courses: resultCourses,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error listing courses:", error);
    return new Response(
      superjson.stringify({ error: "Failed to fetch courses" }),
      { status: 500 }
    );
  }
}
