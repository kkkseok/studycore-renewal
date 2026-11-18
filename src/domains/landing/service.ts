/**
 * Landing 도메인 - 서비스
 *
 * ⚠️ DB 쿼리 금지 → repository.ts 경유
 * ⚠️ 타입/스키마 정의 금지 → model.ts
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  createLandingSchema,
  updateLandingSchema,
  type CreateLandingInput,
  type UpdateLandingInput,
  type LandingServiceResult,
  type Landing,
} from "./model";
import * as landingRepo from "./repository";

export async function getLandingList(
  supabase: SupabaseClient,
  options?: { page?: number; pageSize?: number }
): Promise<{ landings: Landing[]; total: number; page: number; pageSize: number }> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 10;
  const offset = (page - 1) * pageSize;

  const { data, count } = await landingRepo.getLandings(supabase, {
    limit: pageSize,
    offset,
  });

  return { landings: data, total: count, page, pageSize };
}

export async function getLandingDetail(
  supabase: SupabaseClient,
  id: string
): Promise<LandingServiceResult> {
  try {
    const landing = await landingRepo.getLandingById(supabase, id);
    if (!landing)
      return { success: false, error: "랜딩페이지를 찾을 수 없습니다." };
    return { success: true, landing };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "랜딩페이지 조회 실패",
    };
  }
}

/** 공개 서빙용 — 활성 slug만, 에러 시 null */
/**
 * 공개 서빙용 조회. 없거나 비활성이면 null, DB 오류는 throw 한다.
 * (호출측이 결과를 캐시하므로, 일시적 오류를 '없음'으로 바꿔 1분간 404가 캐시되는 일을 막는다)
 */
export async function getLandingForServe(
  supabase: SupabaseClient,
  slug: string
): Promise<Landing | null> {
  return landingRepo.getLandingBySlug(supabase, slug);
}

export async function createLanding(
  supabase: SupabaseClient,
  input: CreateLandingInput
): Promise<LandingServiceResult> {
  try {
    const validation = createLandingSchema.safeParse(input);
    if (!validation.success)
      return { success: false, error: validation.error.issues[0].message };

    const landing = await landingRepo.createLanding(supabase, validation.data);
    return { success: true, landing };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "랜딩페이지 생성 실패",
    };
  }
}

export async function updateLanding(
  supabase: SupabaseClient,
  id: string,
  input: UpdateLandingInput
): Promise<LandingServiceResult> {
  try {
    const validation = updateLandingSchema.safeParse(input);
    if (!validation.success)
      return { success: false, error: validation.error.issues[0].message };

    const landing = await landingRepo.updateLanding(supabase, id, validation.data);
    return { success: true, landing };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "랜딩페이지 수정 실패",
    };
  }
}

export async function deleteLanding(
  supabase: SupabaseClient,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await landingRepo.deleteLanding(supabase, id);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "랜딩페이지 삭제 실패",
    };
  }
}
