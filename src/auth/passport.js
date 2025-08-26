import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

passport.serializeUser((user, done) => {
  done(null, user.id); // _id de Mongo
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).lean();
    done(null, user);
  } catch (e) {
    done(e);
  }
});

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL}/auth/google/callback`
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value ?? null;
      const picture = profile.photos?.[0]?.value ?? null;

      let user = await User.findOne({ googleId: profile.id });
      if (!user) {
        user = await User.create({
          googleId: profile.id,
          email,
          name: profile.displayName,
          picture,
          lastLogin: new Date()
        });
      } else {
        user.lastLogin = new Date();
        if (!user.email && email) user.email = email;
        if (!user.picture && picture) user.picture = picture;
        await user.save();
      }
      return done(null, user);
    } catch (e) {
      return done(e);
    }
  }
));

export default passport;
