"use server";
import { revalidatePath } from "next/cache";
import { loadResourceOptions, saveResources, ResourceError } from "./service";
import type {
  AddResourcesInput,
  AddResourcesResult,
  ResourceResult,
} from "@/lib/resources";

export async function getResourceOptions(
  projectId: string,
): Promise<ResourceResult> {
  try {
    return { ok: true, options: await loadResourceOptions(projectId) };
  } catch (error) {
    if (!(error instanceof ResourceError))
      console.error("Resource availability could not be loaded.");
    return {
      ok: false,
      error:
        error instanceof ResourceError
          ? error.message
          : "Unable to load resources. Check the database connection and try again.",
    };
  }
}
export async function addProjectResources(
  input: AddResourcesInput,
): Promise<AddResourcesResult> {
  try {
    const result = await saveResources(input);
    revalidatePath("/");
    return { ok: true, ...result };
  } catch (error) {
    if (!(error instanceof ResourceError))
      console.error("Resource assignment could not be saved.");
    return {
      ok: false,
      error:
        error instanceof ResourceError
          ? error.message
          : "Unable to save resources. Refresh the overview to check assignments before trying again.",
    };
  }
}
