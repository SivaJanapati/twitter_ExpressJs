const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(4000, () => {
      console.log("Server started at localhost");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//Api1

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const checkUser = `select username from user where username='${username}';`;
  const dbUser = await db.get(checkUser);
  console.log(dbUser);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const requestQuery = `insert into user(name, username, password, gender) values(
          '${name}','${username}','${hashedPassword}','${gender}');`;
      await database.run(requestQuery);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

//Api2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUserQuery = `select * from user where username='${username}';`;
  const dbUser = await db.get(checkUserQuery);
  if (dbUser !== undefined) {
    const comparePassword = await bcrypt.compare(password, dbUser.password);
    if (comparePassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "11111");
      response.send({ jwtToken });
      console.log({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

//Authentication
const AuthenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "11111", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//Api3

app.get("/user/tweets/feed/", AuthenticateToken, async (request, response) => {
  let { username } = request;
  const userQuery = `select * from user where username='${username}';`;
  const user = await db.get(userQuery);
  const followingUserQuery = `select following_user_id from follower where follower_user_id=${user.user_id};`;
  const followingUserIds = await db.all(followingUserQuery);
  const followingIdSample = followingUserIds.map((each) => {
    return each.following_user_id;
  });
  console.log(followingIdSample);
  const tweetsQuery = `select user.username, tweet.tweet, tweet.date_time as dateTime from user inner join tweet on user.user_id=tweet.user_id where user.user_id in (${followingIdSample}) order by tweet.date_time desc limit 4;`;
  const tweets = await db.all(tweetsQuery);
  response.send(tweets);
});

//Api4

app.get("/user/following/", AuthenticateToken, async (request, response) => {
  let { username } = request;
  const userQuery = `select * from user where username='${username}';`;
  const user = await db.get(userQuery);
  const followingUserQuery = `select following_user_id from follower where follower_user_id=${user.user_id};`;
  const followingUserIds = await db.all(followingUserQuery);
  const followingIdSample = followingUserIds.map((each) => {
    return each.following_user_id;
  });
  const followingQuery = `select  name from user where user_id in (${followingIdSample});`;
  const following = await db.all(followingQuery);
  response.send(following);
});

//Api5

app.get("/user/followers/", AuthenticateToken, async (request, response) => {
  let { username } = request;
  const userQuery = `select * from user where username='${username}';`;
  const user = await db.get(userQuery);
  const followerIdQuery = `select follower_user_id from follower where following_user_id=${user.user_id};`;
  const followerUserIds = await db.all(followerIdQuery);
  const followerSample = followerUserIds.map((each) => {
    return each.follower_user_id;
  });
  const followersQuery = `select name from user where user_id in (${followerSample});`;
  const followers = await db.all(followersQuery);
  response.send(followers);
});

const apiTweetOutput = (tweetData, likesCount, replyCount) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: replyCount.replies,
    dateTime: tweetData.date_time,
  };
};

//Api6

app.get("/tweets/:tweetId/", AuthenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const userQuery = `select * from user where username='${username}';`;
  const user = await db.get(userQuery);
  const followingUserQuery = `select following_user_id from follower where follower_user_id=${user.user_id};`;
  const followingIds = await db.all(followingUserQuery);
  const followingIdSamples = followingIds.map((each) => {
    return each.following_user_id;
  });
  const tweetsQuery = `select tweet_id from tweet where user_id in (${followingIdSamples});`;
  const tweetIds = await db.all(tweetsQuery);
  const tweetIdSamples = tweetIds.map((each) => {
    return each.tweet_id;
  });
  if (tweetIdSamples.includes(parseInt(tweetId))) {
    const tweetQuery = `select tweet,date_time from tweet where tweet_id=${tweetId};`;
    const tweetData = await db.get(tweetQuery);
    const likeQuery = `select count(like_id) as likes from like where tweet_id=${tweetId};`;
    const likesCount = await db.get(likeQuery);
    const replyQuery = `select count(user_id) as replies from like where tweet_id=${tweetId};`;
    const replyCount = await db.get(replyQuery);
    response.send(apiTweetOutput(tweetData, likesCount, replyCount));
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//Api7

const convertLikesUsernames = (list) => {
  return {
    likes: list,
  };
};

app.get(
  "/tweets/:tweetId/likes/",
  AuthenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const userQuery = `select * from user where username='${username}';`;
    const user = await db.get(userQuery);
    const followingUserIdQuery = `select following_user_id from follower where follower_user_id=${user.user_id};`;
    const followingUserIds = await db.all(followingUserIdQuery);
    const followingIdSamples = followingUserIds.map((each) => {
      return each.following_user_id;
    });
    //console.log(followingIdSamples);
    const tweetsQuery = `select tweet_id from tweet where user_id in (${followingIdSamples});`;
    const tweetIds = await db.all(tweetsQuery);
    const tweetIdSamples = tweetIds.map((each) => {
      return each.tweet_id;
    });
    //console.log(tweetIdSamples);
    if (tweetIdSamples.includes(parseInt(tweetId))) {
      const tweetLikesQuery = `select user.username from user inner join like on user.user_id=like.user_id where like.tweet_id=${tweetId};`;
      const tweetLikes = await db.all(tweetLikesQuery);
      const tweetLikeSamples = tweetLikes.map((each) => {
        return each.username;
      });
      response.send(convertLikesUsernames(tweetLikeSamples));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//Api8

const convertReplies = (list) => {
  return {
    replies: list,
  };
};

app.get(
  "/tweets/:tweetId/replies/",
  AuthenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const userQuery = `select * from user where username='${username}';`;
    const user = await db.get(userQuery);
    const followingUserIdQuery = `select following_user_id from follower where follower_user_id=${user.user_id};`;
    const followingUserIds = await db.all(followingUserIdQuery);
    const followingIdSamples = followingUserIds.map((each) => {
      return each.following_user_id;
    });
    //console.log(followingIdSamples);
    const tweetsQuery = `select tweet_id from tweet where user_id in (${followingIdSamples});`;
    const tweetIds = await db.all(tweetsQuery);
    const tweetIdSamples = tweetIds.map((each) => {
      return each.tweet_id;
    });
    //console.log(tweetIdSamples);
    if (tweetIdSamples.includes(parseInt(tweetId))) {
      const tweetReplyQuery = `select user.name , reply.reply  from user inner join reply on user.user_id=reply.user_id where reply.tweet_id=${tweetId};`;
      const tweetReply = await db.all(tweetReplyQuery);

      response.send(convertReplies(tweetReply));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//Api9

app.get("/user/tweets/", AuthenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId);
  //get tweets made by user
  const getTweetIdsQuery = `select tweet_id from tweet where user_id=${getUserId.user_id};`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);
  const getTweetIds = getTweetIdsArray.map((eachId) => {
    return parseInt(eachId.tweet_id);
  });
  const query = `SELECT tweet.tweet, COUNT(like.like_id) as likes, COUNT(reply.reply_id) as replies, tweet.date_time
    FROM tweet
    LEFT JOIN like ON tweet.tweet_id = like.tweet_id
    LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id
    WHERE tweet.user_id in (${getTweetIds})
    GROUP BY tweet.tweet_id;`;
  const responseData = await db.all(query);
  //console.log(responseData);
  const tweetsData = responseData.map((each) => ({
    tweet: each.tweet,
    likes: each.likes,
    replies: each.replies,
    dateTime: each.date_time,
  }));
  response.send(tweetsData);
});

//Api10

app.post("/user/tweets/", AuthenticateToken, async (request, response) => {
  let { username } = request;
  const userQuery = `select user_id from user where username='${username}';`;
  const user = await db.get(userQuery);
  const { tweet } = request.body;
  const currentDate = new Date();
  const tweetQuery = `insert into tweet (tweet,user_id,date_time) values ("${tweet}",${user.user_id},"${currentDate}");`;
  const tweetData = await db.run(tweetQuery);
  const tweet_id = tweetData.lastID;
  response.send("Created a Tweet");
});

//Api11

app.delete(
  "/tweets/:tweetId/",
  AuthenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    const userQuery = `select user_id from user where username='${username}';`;
    const user = await db.get(userQuery);
    const tweetQuery = `select tweet_id from tweet where user_id=${user.user_id};`;
    const tweetsData = await db.all(tweetQuery);
    //console.log(tweetsData);
    const tweetIdSamples = tweetsData.map((each) => {
      return each.tweet_id;
    });
    //console.log(tweetIdSamples);
    if (tweetIdSamples.includes(parseInt(tweetId))) {
      const deleteQuery = `delete from tweet where tweet_id=${tweetId}`;
      const data = await db.run(deleteQuery);

      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
