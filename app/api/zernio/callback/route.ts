import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  const connected = params.get("connected")
  const profileId = params.get("profileId")
  const accountId = params.get("accountId")
  const username = params.get("username")

  console.log("ZERNIO CALLBACK", {
    connected,
    profileId,
    accountId,
    username
  })

  if (!profileId || !accountId) {
    return NextResponse.json(
      {
        error: "Missing zernio data",
        profileId,
        accountId
      },
      {
        status: 400
      }
    )
  }

  const supabase = await getSupabaseServerClient()

  const { data, error: upsertError } = await supabase
    .from("users")
    .insert({
      username: username || `user_${accountId}`,
      business_account_id: accountId,
      page_id: profileId,
      updated_at: new Date().toISOString(),
    })
    .select()

  console.log("ZERNIO USER SAVE", {
    data,
    error: upsertError
  })

  if (upsertError) {
    console.error("ZERNIO SUPABASE ERROR", upsertError)

    return NextResponse.json(
      {
        error: upsertError.message
      },
      {
        status: 500
      }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const response = NextResponse.redirect(
    `${appUrl}/dashboard`
  )

  response.cookies.set(
    "zernio_session",
    JSON.stringify({
      profileId,
      accountId,
      username,
      platform: connected
    }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    }
  )

  return response
}
