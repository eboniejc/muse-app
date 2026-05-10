import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { Ebooks } from "../../helpers/schema";

export const schema = z.object({});

export type EbookWithStatus = Pick<
  Selectable<Ebooks>,
  | "id"
  | "title"
  | "titleVi"
  | "description"
  | "descriptionVi"
  | "coverImageUrl"
  | "fileUrl"
  | "courseId"
  | "sortOrder"
> & {
  courseName: string | null;
  isUnlocked: boolean;
};

export type OutputType = {
  ebooks: EbookWithStatus[];
};

const fallbackLinks = [
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

function getClientFallbackEbooks(): OutputType {
  return {
    ebooks: fallbackLinks.map((fileUrl, index) => ({
      id: -(index + 1),
      title: `E-book ${index + 1}`,
      titleVi: `E-book ${index + 1}`,
      description: `DJ learning material #${index + 1}`,
      descriptionVi: `Tai lieu hoc DJ #${index + 1}`,
      coverImageUrl: null,
      fileUrl,
      courseId: null,
      sortOrder: index,
      courseName: null,
      isUnlocked: false,
    })),
  };
}

export const getEbooks = async (
  body: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  try {
    const result = await fetch(`/_api/ebooks/list`, {
      method: "GET",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!result.ok) {
      return getClientFallbackEbooks();
    }
    const text = await result.text();
    const parsed = superjson.parse<OutputType>(text);
    if (!parsed || !Array.isArray(parsed.ebooks)) {
      return getClientFallbackEbooks();
    }
    return parsed;
  } catch (error) {
    console.error("getEbooks fallback due to request error:", error);
    return getClientFallbackEbooks();
  }
};
