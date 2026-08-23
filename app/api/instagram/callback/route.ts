import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code")
    const error = request.nextUrl.searchParams.get("error")

    if (error) {
      return NextResponse.redirect(
        new URL("/?error=" + error, request.url)
      )
    }

    if (!code) {
      return NextResponse.json(
        { error: "Missing code" },
        { status: 400 }
      )
    }

    const clientId = process.env.INSTAGRAM_APP_ID
    const clientSecret = process.env.INSTAGRAM_APP_SECRET
    const redirectUri = process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Missing Instagram env variables")
    }


    // exchange code
    const tokenResponse = await fetch(
      "https://api.instagram.com/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code,
        }),
      }
    )


    const tokenData = await tokenResponse.json()


    if (!tokenResponse.ok) {
      console.log("TOKEN ERROR", tokenData)

      return NextResponse.json(
        tokenData,
        { status: 400 }
      )
    }


    const shortToken = tokenData.access_token
    const instagramUserId = String(tokenData.user_id)


    // long token
    const longResponse = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${shortToken}`
    )


    const longData = await longResponse.json()

    const accessToken =
      longData.access_token || shortToken



    // profile
    const profileResponse = await fetch(
      `https://graph.instagram.com/v24.0/me?fields=id,username&access_token=${accessToken}`
    )


    const profile = await profileResponse.json()


    const username =
      profile.username || `user_${instagramUserId}`


    console.log("CALLBACK REACHED BEFORE SUPABASE")


    const supabase = await getSupabaseServerClient()


    const { data, error: upsertError } = await supabase
      .from("users")
      .upsert(
        {
          id: Number(instagramUserId),
          username,
          access_token: accessToken,
          business_account_id: Number(instagramUserId),
          page_id: instagramUserId,
          token_expires_at:
            new Date(
              Date.now() + 60 * 24 * 60 * 60 * 1000
            ).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        }
      )


    console.log(
      "USER SAVE:",
      data,
      upsertError
    )


    if (upsertError) {
      console.error(
        "USER UPSERT ERROR:",
        upsertError
      )

      throw upsertError
    }


    console.log(
      "USER SAVED:",
      data
    )


    const response = NextResponse.redirect(
      new URL("/dashboard", request.url)
    )


    response.cookies.set(
      "insta_session",
      JSON.stringify({
        username,
        userId: instagramUserId,
      }),
      {
        path: "/",
        maxAge: 60 * 24 * 60 * 60,
        sameSite: "lax",
        secure: true,
      }
    )


    return response


  } catch (err:any) {

    console.error(
      "INSTAGRAM CALLBACK ERROR",
      err
    )

    return NextResponse.json(
      {
        error: err.message
      },
      {
        status:500
      }
    )
  }
}
