import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { APP_NAME } from "@/lib/brand";

/**
 * A starting point, not terms of service.
 *
 * See the note in PrivacyPolicy.tsx — the same reasoning applies. This page
 * describes how the software behaves, and leaves the promises to you.
 */
const TermsOfService = () => {
  const [, setLocation] = useLocation();

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 text-gray-400 hover:text-primary"
        onClick={() => setLocation("/")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Home
      </Button>

      <Card className="bg-dark-light border-dark-lighter">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Terms of Service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-gray-300">
          <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-amber-300">This is a template, not an agreement.</p>
              <p>
                Replace this page before you launch. It describes how the software behaves so you
                have somewhere accurate to start, but it binds nobody and is not legal advice.
              </p>
            </div>
          </div>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-primary">What the software does</h2>
            <p>
              {APP_NAME} lets people create an account, post images with details attached, rate
              other people's posts by swiping, follow each other, comment, and send direct messages.
              A leaderboard ranks accounts by the points their posts earn.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-primary">What is public</h2>
            <p>
              Profiles, posts, comments, follower lists and the leaderboard are readable by anyone,
              including people who are not signed in. Direct messages and notifications are visible
              only to the accounts involved — and to whoever operates the server.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-primary">Moderation as built</h2>
            <p>
              Accounts marked as administrators can edit and delete any user, remove any post, read
              reports, suspend accounts and send announcements. Any signed-in user can report a post
              or another user. A suspended account cannot sign in.
            </p>
            <p>
              There is no automated moderation, no age verification and no content scanning in this
              codebase. Usernames and display names are checked against a small word list, which is
              not a moderation system.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-primary">What you need to add</h2>
            <p>Before launching, this page needs at least:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Who you are, and which jurisdiction's law governs the agreement.</li>
              <li>What people may and may not post, and what happens when they break the rules.</li>
              <li>Who owns uploaded content, and what licence users grant you over it.</li>
              <li>Any minimum age, and how you handle accounts below it.</li>
              <li>Your warranty disclaimers, liability limits, and how the terms may change.</li>
              <li>How an account is closed, by the user or by you.</li>
            </ul>
            <p>
              If real people will use your deployment, have someone qualified review it. Terms of
              service are a contract, and this page is not one.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
};

export default TermsOfService;
