/* Backswing — content data
   Exercises, routines, symptom planner, injury guide, swing faults, habits.
   Plain-language, physio-informed. Not a substitute for a clinician. */

const AREAS = {
  neck:     { label: 'Neck',        short: 'Neck' },
  shoulder: { label: 'Shoulder',    short: 'Shoulder' },
  upback:   { label: 'Mid and upper back', short: 'Mid back' },
  lowback:  { label: 'Lower back',  short: 'Lower back' },
  hip:      { label: 'Hip',         short: 'Hip' },
  elbow:    { label: 'Elbow',       short: 'Elbow' },
  wrist:    { label: 'Wrist and hand', short: 'Wrist' },
  knee:     { label: 'Knee',        short: 'Knee' },
  full:     { label: 'Whole body',  short: 'Body' }
};

const TYPES = {
  warmup:    'Warm-up',
  mobility:  'Mobility',
  stability: 'Stability',
  strength:  'Strength',
  stretch:   'Stretch'
};

/* secs = default block length in the player. sides = do both sides. */
const EXERCISES = [
  {
    id: 'legswing', name: 'Leg swings', areas: ['hip', 'lowback'], type: 'warmup', pose: 'legSwing',
    secs: 30, sides: true, reps: '12 swings each leg', where: 'course', gear: 'Something to hold',
    why: 'Loosens the hip flexors and hamstrings so the hips can turn instead of the lower back.',
    steps: [
      'Hold the cart, a club planted in the ground, or a fence.',
      'Swing one leg forward and back, letting it travel a little further each rep.',
      'Keep the standing knee soft and the trunk tall. The leg moves, the spine does not.',
      'Then swing the same leg across the body and out to the side.'
    ],
    cue: 'Let the leg swing like a pendulum. No kicking.',
    avoid: 'Arching the lower back to get the leg higher.',
    golf: 'Tight hip flexors pull the pelvis into an arch at address (S-posture), which loads the lumbar joints on every swing.'
  },
  {
    id: 'wgs', name: "World's greatest stretch", areas: ['hip', 'upback', 'full'], type: 'warmup', pose: 'lungeReach',
    secs: 40, sides: true, reps: '5 slow reps each side', where: 'course', gear: 'None',
    why: 'One move that opens the hips, the mid back and the hamstrings, the three things a golf swing borrows from.',
    steps: [
      'Step into a long lunge, back knee off the ground.',
      'Put the hand on the same side as the front foot on the ground inside that foot.',
      'Reach the other arm to the sky, turning the chest to follow it.',
      'Come back down, then rock back and straighten the front leg to feel the hamstring.'
    ],
    cue: 'Turn from the ribs. Follow your hand with your eyes.',
    avoid: 'Letting the front knee collapse inward.',
    golf: 'Rehearses the exact separation between hips and chest that a full turn needs.'
  },
  {
    id: 'clubrot', name: 'Club rotations', areas: ['upback', 'lowback'], type: 'mobility', pose: 'standClub',
    secs: 45, sides: false, reps: '10 each way', where: 'course', gear: 'A club',
    why: 'Wakes up the rotation you need from the mid back, with the hips held still.',
    steps: [
      'Lay a club across the back of your shoulders and hold the ends.',
      'Set up in your golf posture, hinged at the hips, knees soft.',
      'Turn the chest slowly to the right as far as it goes, then the left.',
      'Keep the belt buckle facing the ball. The turn comes from above the belt.'
    ],
    cue: 'Nose stays over the ball. Shoulders turn under it.',
    avoid: 'Standing up out of the posture as you turn.',
    golf: 'If the hips turn with the chest here, your mid back is stiff and the lower back will be doing the rotating on the course.'
  },
  {
    id: 'hinge', name: 'Hip hinge with a club', areas: ['lowback', 'hip'], type: 'stability', pose: 'hinge',
    secs: 45, sides: false, reps: '10 slow reps', where: 'course', gear: 'A club',
    why: 'Teaches the body to bend from the hips with a neutral spine. This is the posture every safe swing starts from.',
    steps: [
      'Hold a club along your spine: one hand at the neck, one at the lower back.',
      'The club should touch the back of the head, between the shoulder blades and the tailbone.',
      'Push the hips back and let the chest tip forward, keeping all three contact points.',
      'Stand tall by squeezing the glutes, not by arching.'
    ],
    cue: 'Bum back, chest proud, club stays glued.',
    avoid: 'Losing contact at the lower back (rounding) or at the head (chin poking).',
    golf: 'This is your address posture. Rounded (C-posture) or over-arched (S-posture) setups are where most back pain begins.'
  },
  {
    id: 'ohsquat', name: 'Overhead club squat', areas: ['hip', 'knee', 'upback'], type: 'warmup', pose: 'squatTee',
    secs: 40, sides: false, reps: '8 reps', where: 'course', gear: 'A club',
    why: 'Opens the ankles, hips and shoulders at once and gets blood into the legs before the first tee.',
    steps: [
      'Hold a club wide overhead, arms straight.',
      'Sit down into a squat as deep as is comfortable, heels down.',
      'Keep the club stacked over the middle of your feet.',
      'Drive up through the heels.'
    ],
    cue: 'Chest up, club back, heels heavy.',
    avoid: 'Heels lifting. Squat less deep instead.',
    golf: 'Golfers who can squat with heels down almost never early-extend (thrust the hips at the ball) in the downswing.'
  },
  {
    id: 'armcircles', name: 'Arm circles and cross-body swings', areas: ['shoulder'], type: 'warmup', pose: 'armCircles',
    secs: 30, sides: false, reps: '10 each direction, then 10 swings', where: 'course', gear: 'None',
    why: 'Warms the rotator cuff before the lead shoulder gets stretched across the chest at the top of the swing.',
    steps: [
      'Big slow circles forward, then backward, with straight arms.',
      'Then swing both arms across your chest and back out wide, like hugging then opening.',
      'Build the size of the movement gradually.'
    ],
    cue: 'Smooth, not fast. Feel the shoulder blades glide.',
    avoid: 'Shrugging the shoulders up to the ears.',
    golf: 'The lead shoulder is the most loaded joint at the top of the backswing. Warm it before you ask it to work.'
  },
  {
    id: 'wristrot', name: 'Wrist and forearm circles with a club', areas: ['wrist', 'elbow'], type: 'warmup', pose: 'pronation',
    secs: 30, sides: false, reps: '10 each way', where: 'course', gear: 'A club',
    why: 'Warms the tendons on both sides of the elbow that absorb impact with the ground.',
    steps: [
      'Hold a club near the head so the grip end points up, elbow tucked at your side.',
      'Rotate the palm up and down, letting the club swing side to side.',
      'Then draw slow circles with the club head using only the wrist.',
      'Swap hands.'
    ],
    cue: 'Elbow pinned to the ribs. Only the forearm moves.',
    avoid: 'Gripping hard. Hold it just firm enough not to drop it.',
    golf: 'Cold forearm tendons plus a fat shot off a hard mat is the classic start of golfer’s elbow.'
  },
  {
    id: 'pswings', name: 'Progressive practice swings', areas: ['full'], type: 'warmup', pose: 'swing',
    secs: 75, sides: false, reps: '5 half swings, 5 three-quarter, 5 full', where: 'course', gear: 'A short iron',
    why: 'The last step before the first tee: the body rehearses the full pattern at gradually increasing speed.',
    steps: [
      'Start with a wedge or short iron.',
      'Five half swings, waist high, at half speed.',
      'Five three-quarter swings at moderate speed.',
      'Five full swings, the last two at course speed.'
    ],
    cue: 'Turn the chest, let the arms follow. Finish balanced.',
    avoid: 'Going straight to full-speed driver swings on a cold body.',
    golf: 'Golfers who warm up for even five minutes report fewer injuries and swing faster on the first tee.'
  },
  {
    id: 'catcow', name: 'Cat-cow', areas: ['lowback', 'upback'], type: 'mobility', pose: 'quadruped',
    secs: 60, sides: false, reps: '10 slow rounds', where: 'home', gear: 'Floor',
    why: 'Moves every segment of the spine gently, which calms a guarded lower back and gets the mid back moving.',
    steps: [
      'On hands and knees, wrists under shoulders, knees under hips.',
      'Breathe out and round the whole spine up toward the ceiling, tucking the tailbone.',
      'Breathe in and let the belly drop, lifting the chest and tailbone.',
      'Move slowly and try to bend a little at every level, not just the middle.'
    ],
    cue: 'Start each movement from the tailbone and let it ripple up.',
    avoid: 'Forcing the end range if it stings. Stay in the comfortable middle.',
    golf: 'A back that only bends in one spot is a back that gets sore in that spot. Spread the movement.'
  },
  {
    id: 'openbook', name: 'Open book', areas: ['upback'], type: 'mobility', pose: 'sideLying',
    secs: 45, sides: true, reps: '8 slow reps each side', where: 'home', gear: 'Floor',
    why: 'The single best mid-back rotation drill. The hips are pinned, so all the turn has to come from the thoracic spine.',
    steps: [
      'Lie on your side with knees bent to 90 degrees and stacked, arms straight out in front.',
      'Keep the knees pressed together and on the floor.',
      'Open the top arm like a book, following the hand with your eyes, until the shoulder blade reaches toward the floor.',
      'Pause, breathe out, then close the book.'
    ],
    cue: 'Knees glued together. If they lift, the lower back is cheating.',
    avoid: 'Letting the top knee float up to get the arm further.',
    golf: 'The thoracic spine should give you about 35 degrees of turn each way. Most desk-bound golfers have half that.'
  },
  {
    id: 'thread', name: 'Thread the needle', areas: ['upback', 'shoulder'], type: 'mobility', pose: 'threadNeedle',
    secs: 40, sides: true, reps: '8 reps each side', where: 'home', gear: 'Floor',
    why: 'Rotation for the mid back with a stretch across the back of the shoulder thrown in.',
    steps: [
      'Start on hands and knees.',
      'Slide one arm under the body, palm up, reaching across to the far side.',
      'Let the shoulder and ear sink toward the floor.',
      'Come back and reach the same arm up to the ceiling, turning the chest open.'
    ],
    cue: 'Hips stay square to the floor throughout.',
    avoid: 'Collapsing onto the supporting elbow.',
    golf: 'Frees the trail-side ribcage so the backswing turn does not run out early.'
  },
  {
    id: 'text', name: 'Thoracic extension over a chair', areas: ['upback', 'neck'], type: 'mobility', pose: 'chairExt',
    secs: 45, sides: false, reps: '10 reps', where: 'home', gear: 'Chair with a firm back',
    why: 'Undoes hours of sitting. A mid back that can extend is a mid back that can rotate.',
    steps: [
      'Sit with the top of the chair back level with your shoulder blades.',
      'Hands behind your head, elbows forward.',
      'Lean back over the edge of the chair, breathe out, and let the upper back arch.',
      'Come back up. Move the chair contact point up or down a little to hit different segments.'
    ],
    cue: 'Bend over the chair, not at the lower back. Keep the ribs down.',
    avoid: 'Arching the lower back or cranking the neck.',
    golf: 'Rounded desk posture becomes C-posture at address, which blocks shoulder turn and sends the work to the lumbar spine.'
  },
  {
    id: 'wallangel', name: 'Wall angels', areas: ['upback', 'shoulder', 'neck'], type: 'mobility', pose: 'wallAngel',
    secs: 45, sides: false, reps: '10 slow reps', where: 'home', gear: 'A wall',
    why: 'Trains the shoulder blades and upper back to work with the ribs down, which is the posture for a full, safe turn.',
    steps: [
      'Stand with your back, head and bum against a wall, feet a little away from it.',
      'Flatten the lower back gently toward the wall.',
      'Bring the arms up in a goalpost shape with the backs of the hands on the wall.',
      'Slide the arms up as high as you can without anything leaving the wall, then back down.'
    ],
    cue: 'If the lower back arches off the wall, stop the arms there. That is your range for now.',
    avoid: 'Cheating with the neck or flaring the ribs.',
    golf: 'Better overhead reach means a fuller backswing without the lower back arching to fake it.'
  },
  {
    id: 'hip9090', name: '90/90 hip switches', areas: ['hip', 'lowback'], type: 'mobility', pose: 'seated9090',
    secs: 60, sides: false, reps: '10 switches', where: 'home', gear: 'Floor',
    why: 'Hip internal rotation is the movement most golfers lack. Without it the lower back has to make up the difference on every swing.',
    steps: [
      'Sit on the floor with one leg bent in front at 90 degrees and the other bent to the side at 90 degrees.',
      'Sit tall. Hands lightly on the floor behind you for balance if needed.',
      'Lift both knees and switch them to the other side, sitting into the new position.',
      'Try to keep the trunk tall as the knees travel. Go slow.'
    ],
    cue: 'Sit up. The taller you are, the more the hips have to do the work.',
    avoid: 'Rounding forward to force the knees down.',
    golf: 'The lead hip needs roughly 45 degrees of internal rotation through impact. Stiff hips sway and slide, and the back pays for it.'
  },
  {
    id: 'hipflexor', name: 'Half-kneeling hip flexor stretch', areas: ['hip', 'lowback'], type: 'stretch', pose: 'halfKneel',
    secs: 30, sides: true, reps: 'Hold 30 seconds each side', where: 'home', gear: 'Floor, cushion optional',
    why: 'Tight hip flexors tilt the pelvis forward and jam the lumbar joints. This lengthens them without arching the back.',
    steps: [
      'Kneel on one knee with the other foot forward, both knees at right angles.',
      'Squeeze the glute of the kneeling side and tuck the tailbone slightly under.',
      'Shift forward a few centimetres until you feel the front of the kneeling hip.',
      'Reach the same-side arm overhead for more.'
    ],
    cue: 'The stretch lives in the front of the hip, not in the lower back. If you feel the back, tuck harder and shift less.',
    avoid: 'Arching and leaning forward from the waist.',
    golf: 'The number one fix for S-posture and for golfers who feel the lower back after standing on the range.'
  },
  {
    id: 'figure4', name: 'Figure-4 at the cart', areas: ['hip', 'lowback'], type: 'stretch', pose: 'figure4Stand',
    secs: 30, sides: true, reps: 'Hold 30 seconds each side', where: 'course', gear: 'Cart, bench or wall',
    why: 'Releases the deep glute muscles that stiffen after 18 holes and refer ache into the lower back.',
    steps: [
      'Hold the cart or a rail for balance.',
      'Cross one ankle over the opposite knee.',
      'Sit the hips back and down, as if into a chair, keeping the chest tall.',
      'Hold. Let the crossed knee sink.'
    ],
    cue: 'Sit back into it. Breathe.',
    avoid: 'Rounding the spine to get lower.',
    golf: 'That deep ache in the buttock after a round is usually the piriformis and glutes, not the spine.'
  },
  {
    id: 'deadbug', name: 'Dead bug', areas: ['lowback'], type: 'stability', pose: 'deadbug',
    secs: 60, sides: false, reps: '8 slow reps each side', where: 'home', gear: 'Floor',
    why: 'Teaches the deep core to hold the lower back still while the limbs move, which is exactly its job in the swing.',
    steps: [
      'Lie on your back, arms straight up, knees over hips, shins parallel to the floor.',
      'Press the lower back gently into the floor and keep it there.',
      'Breathe out and lower one arm overhead and the opposite leg toward the floor.',
      'Only go as far as the back stays flat. Return and switch.'
    ],
    cue: 'Slow. The floor under your lower back should never lose pressure.',
    avoid: 'Holding your breath. The exhale is the exercise.',
    golf: 'A lumbar spine that can stay quiet under load rotates less and hurts less.'
  },
  {
    id: 'birddog', name: 'Bird dog', areas: ['lowback'], type: 'stability', pose: 'birddog',
    secs: 60, sides: false, reps: '8 reps each side, 3 second holds', where: 'home', gear: 'Floor',
    why: 'The classic lower back stabiliser. Builds the endurance the back muscles need to protect the spine for four hours.',
    steps: [
      'On hands and knees, spine neutral, like a table.',
      'Reach one arm forward and the opposite leg back, no higher than the trunk.',
      'Hold three seconds. Imagine a glass of water balanced on your lower back.',
      'Sweep the elbow and knee under the body to touch, then reach out again.'
    ],
    cue: 'Make a fist with the reaching hand and point the heel back. Long, not high.',
    avoid: 'Twisting the hips to lift the leg.',
    golf: 'Recommended by spine researchers as one of the three safest exercises for a sore back.'
  },
  {
    id: 'sideplank', name: 'Side plank', areas: ['lowback', 'hip'], type: 'stability', pose: 'sidePlank',
    secs: 25, sides: true, reps: 'Hold 20 to 30 seconds each side', where: 'home', gear: 'Floor',
    why: 'Builds the side muscles of the trunk that resist the sideways bending the swing puts through the lower back.',
    steps: [
      'Lie on your side, elbow under the shoulder, legs straight and stacked (or knees bent to make it easier).',
      'Lift the hips so the body forms a straight line from head to feet.',
      'Hold. Breathe. Keep the top hip stacked over the bottom one.',
      'Lower with control.'
    ],
    cue: 'Push the floor away with the elbow. Squeeze the top glute.',
    avoid: 'Letting the hips sag or roll back.',
    golf: 'The side bend toward the trail side at impact is normal; the muscles need to be strong enough to control it.'
  },
  {
    id: 'pallof', name: 'Pallof press', areas: ['lowback'], type: 'stability', pose: 'pallof',
    secs: 40, sides: true, reps: '10 reps each side', where: 'home', gear: 'Resistance band',
    why: 'Anti-rotation. The band tries to twist you and the core says no. This is what protects the lower back through impact.',
    steps: [
      'Anchor a band at chest height and stand side-on to it, holding the band at your chest with both hands.',
      'Step away until there is tension.',
      'Press the hands straight out in front of the chest and hold for two seconds.',
      'Bring them back. Do not let the band turn you.'
    ],
    cue: 'Ribs down, hips square, breathe out as you press.',
    avoid: 'Leaning away from the anchor.',
    golf: 'Rotation should come from the hips and mid back. This teaches the lumbar spine to be the stable link between them.'
  },
  {
    id: 'bridge', name: 'Glute bridge', areas: ['hip', 'lowback'], type: 'strength', pose: 'bridge',
    secs: 60, sides: false, reps: '12 reps, 2 second squeeze at the top', where: 'home', gear: 'Floor',
    why: 'Switches the glutes on. Weak glutes make the lower back muscles do the hip’s job in the downswing.',
    steps: [
      'Lie on your back, knees bent, feet flat and hip width apart.',
      'Push through the heels and squeeze the glutes to lift the hips.',
      'Stop when the body is a straight line from knees to shoulders. Do not arch further.',
      'Hold two seconds, lower slowly.'
    ],
    cue: 'Drive with the glutes, not the hamstrings or the back. Tuck the tailbone slightly.',
    avoid: 'Pushing the hips so high the lower back arches.',
    golf: 'The glutes power hip rotation. Strong glutes mean the hips lead the downswing instead of the lower back.'
  },
  {
    id: 'pelvictilt', name: 'Pelvic tilts', areas: ['lowback'], type: 'mobility', pose: 'supineKnees',
    secs: 45, sides: false, reps: '10 slow reps', where: 'home', gear: 'Floor',
    why: 'The gentlest way to move a sore lower back. Good on the morning after a round when everything feels locked.',
    steps: [
      'Lie on your back with knees bent and feet flat.',
      'Breathe out and flatten the lower back into the floor by tilting the pelvis.',
      'Breathe in and let it arch slightly away from the floor.',
      'Small, slow, pain-free movements. Gradually make them a little bigger.'
    ],
    cue: 'Think of the pelvis as a bowl of water tipping forward and back.',
    avoid: 'Using the legs to push. It is a tiny movement from the trunk.',
    golf: 'Also the movement you need to find neutral posture at address, between S-posture and C-posture.'
  },
  {
    id: 'curlup', name: 'McGill curl-up', areas: ['lowback'], type: 'stability', pose: 'curlUp',
    secs: 60, sides: false, reps: '6 reps, 8 second holds', where: 'home', gear: 'Floor',
    why: 'A sit-up that spares the discs. Builds front-of-trunk endurance without bending the lower back.',
    steps: [
      'Lie on your back, one knee bent, one leg straight.',
      'Slide your hands under the small of the back to support its natural curve.',
      'Lift the head and shoulders a few centimetres as one unit, as if lifting the head off a pillow.',
      'Hold eight seconds, breathing. Lower. Switch legs halfway.'
    ],
    cue: 'Barely lift. Tension, not movement.',
    avoid: 'Bending the neck forward or pulling the chin in hard.',
    golf: 'Replaces crunches and sit-ups, which bend the lumbar spine repeatedly and are a poor choice for golfers.'
  },
  {
    id: 'slrdl', name: 'Golfer’s pickup', areas: ['hip', 'lowback', 'knee'], type: 'strength', pose: 'singleLegRDL',
    secs: 40, sides: true, reps: '8 reps each leg', where: 'course', gear: 'None, or a club',
    why: 'Single-leg hinge. Strengthens the hip and teaches you to pick the ball out of the hole without bending the spine.',
    steps: [
      'Stand on one leg, knee soft.',
      'Hinge at the hip, letting the free leg lift behind you as the chest goes forward.',
      'Reach toward the floor with the opposite hand, spine long.',
      'Squeeze the glute of the standing leg to come back up.'
    ],
    cue: 'Heel reaches back, head reaches forward. Hips stay level.',
    avoid: 'Rounding the back to reach lower. Stop where the hip stops.',
    golf: 'You bend to pick up a ball or tee 40 to 60 times a round. Do it this way and that is 60 free reps, not 60 small insults to the discs.'
  },
  {
    id: 'splitsquat', name: 'Split squat', areas: ['knee', 'hip'], type: 'strength', pose: 'splitSquat',
    secs: 40, sides: true, reps: '8 reps each leg', where: 'home', gear: 'None',
    why: 'Leg strength for walking 18 holes and for a lead leg that can brace at impact.',
    steps: [
      'Take a long stride, feet hip width apart for balance.',
      'Lower the back knee straight down toward the floor.',
      'Front shin stays fairly vertical, front heel down.',
      'Drive up through the front heel.'
    ],
    cue: 'Down like an elevator, not forward like a lunge.',
    avoid: 'Letting the front knee cave inward.',
    golf: 'The lead knee takes a sudden twisting load at impact. Strong legs keep it tracking straight.'
  },
  {
    id: 'bander', name: 'Band external rotation', areas: ['shoulder'], type: 'strength', pose: 'bandER',
    secs: 40, sides: true, reps: '12 reps each arm', where: 'home', gear: 'Resistance band',
    why: 'Strengthens the rotator cuff, the small muscles that keep the shoulder centred while the big muscles swing the club.',
    steps: [
      'Anchor a band at elbow height. Stand side-on with the working arm furthest from the anchor.',
      'Elbow bent 90 degrees and tucked to your side. A rolled towel under the elbow helps.',
      'Rotate the forearm outward, away from the belly, keeping the elbow pinned.',
      'Return slowly.'
    ],
    cue: 'The elbow is a hinge on a door. Only the forearm swings.',
    avoid: 'Letting the elbow drift away from the body.',
    golf: 'The trail shoulder rotates hard outward at the top of the swing and the lead shoulder in the follow-through. This cuff needs strength in both.'
  },
  {
    id: 'ytw', name: 'Prone Y-T-W', areas: ['shoulder', 'upback'], type: 'strength', pose: 'ytw',
    secs: 60, sides: false, reps: '6 reps of each letter', where: 'home', gear: 'Floor',
    why: 'Strengthens the muscles between the shoulder blades that hold your posture through a round.',
    steps: [
      'Lie face down, forehead on a towel.',
      'Y: arms overhead and wide, thumbs up. Lift the arms a few centimetres, hold two seconds.',
      'T: arms straight out to the sides, thumbs up. Lift and hold.',
      'W: elbows bent and tucked, squeeze the shoulder blades down and together. Lift and hold.'
    ],
    cue: 'Lift from the shoulder blades, not the neck.',
    avoid: 'Shrugging or arching the lower back.',
    golf: 'Tired posture muscles are why your setup on the 15th tee looks nothing like the 1st.'
  },
  {
    id: 'wristflex', name: 'Wrist flexor stretch', areas: ['elbow', 'wrist'], type: 'stretch', pose: 'wristStretch',
    secs: 30, sides: true, reps: 'Hold 30 seconds each arm', where: 'course', gear: 'None',
    why: 'Stretches the muscles on the palm side of the forearm that attach at the inside of the elbow (golfer’s elbow).',
    steps: [
      'Straighten the arm in front of you, palm up.',
      'With the other hand, gently pull the fingers back toward the floor.',
      'Feel the stretch along the inside of the forearm.',
      'Hold. Keep the elbow straight but not locked.'
    ],
    cue: 'Gentle pull. It should feel like a stretch, not a strain.',
    avoid: 'Bouncing.',
    golf: 'Inside-elbow pain usually comes from the trail arm gripping hard and hitting the ground.'
  },
  {
    id: 'wristext', name: 'Wrist extensor stretch', areas: ['elbow', 'wrist'], type: 'stretch', pose: 'wristStretch',
    secs: 30, sides: true, reps: 'Hold 30 seconds each arm', where: 'course', gear: 'None',
    why: 'Stretches the muscles on the back of the forearm that attach at the outside of the elbow. Outside-elbow pain is actually more common in golfers than the inside kind.',
    steps: [
      'Straighten the arm in front of you, palm down.',
      'With the other hand, gently press the back of the hand so the fingers point at the floor.',
      'Feel the stretch along the top of the forearm.',
      'Hold.'
    ],
    cue: 'Keep the shoulder relaxed.',
    avoid: 'Pressing hard through a sharp pain.',
    golf: 'The lead arm absorbs the shock of impact. A stiff, cold extensor group is the usual cause of lead-elbow pain.'
  },
  {
    id: 'eccwrist', name: 'Eccentric wrist curls', areas: ['elbow'], type: 'strength', pose: 'wristCurl',
    secs: 60, sides: true, reps: '3 sets of 15, slow lowering', where: 'home', gear: 'Light dumbbell, tin of beans, or a club',
    why: 'The evidence-backed fix for elbow tendon pain. Slow lowering rebuilds the tendon rather than irritating it.',
    steps: [
      'Sit with the forearm on your thigh, wrist just past the knee, holding a light weight.',
      'Palm up for the inside of the elbow, palm down for the outside.',
      'Use the other hand to lift the weight up.',
      'Lower it slowly over three to four seconds using only the sore arm. Repeat.'
    ],
    cue: 'Up with help, down slow on your own. A dull ache during is fine; sharp pain is not.',
    avoid: 'Going heavy. Light and slow is the whole point.',
    golf: 'Do this daily for six weeks and most golfer’s and tennis elbow settles. Skip it and it lingers for a year.'
  },
  {
    id: 'pronation', name: 'Pronation and supination with a club', areas: ['elbow', 'wrist'], type: 'strength', pose: 'pronation',
    secs: 40, sides: true, reps: '10 each way, each arm', where: 'course', gear: 'A club',
    why: 'Strengthens forearm rotation, which the elbow tendons rely on to control the club through impact.',
    steps: [
      'Hold a club by the grip end with the head pointing up, elbow bent 90 degrees at your side.',
      'Slowly rotate the palm down, letting the club fall to one side under control.',
      'Rotate back and over to the other side.',
      'Hold the club lower down the shaft to make it easier.'
    ],
    cue: 'Slow and controlled. The weight of the club head does the work.',
    avoid: 'Letting the elbow leave your side.',
    golf: 'Doubles as a grip-pressure lesson. If you have to strangle the club to control it, you are gripping too hard on the course.'
  },
  {
    id: 'chintuck', name: 'Chin tucks', areas: ['neck'], type: 'mobility', pose: 'chinTuck',
    secs: 40, sides: false, reps: '10 reps, 3 second holds', where: 'course', gear: 'None',
    why: 'Resets a forward head. Golfers hold the head still and jut the chin for four hours; this undoes it.',
    steps: [
      'Sit or stand tall, looking straight ahead.',
      'Glide the chin straight back, as if making a double chin, without tipping the head.',
      'Feel the back of the neck lengthen. Hold three seconds.',
      'Release.'
    ],
    cue: 'Back, not down. The eyes stay level.',
    avoid: 'Nodding the head instead of gliding it.',
    golf: 'A jutting chin at address blocks the shoulders from turning under it, so the neck twists instead.'
  },
  {
    id: 'neckstretch', name: 'Upper trap stretch', areas: ['neck', 'shoulder'], type: 'stretch', pose: 'neckStretch',
    secs: 30, sides: true, reps: 'Hold 30 seconds each side', where: 'course', gear: 'None',
    why: 'Releases the muscle from the neck to the shoulder that tightens from carrying a bag and from holding your head over the ball.',
    steps: [
      'Sit or stand tall. Hold the edge of a seat or reach one arm down toward the floor to anchor that shoulder.',
      'Tip the ear on the other side toward that shoulder.',
      'Rest the free hand lightly on the head for a little weight, no pulling.',
      'Breathe and hold.'
    ],
    cue: 'Ear to shoulder, not chin to shoulder.',
    avoid: 'Pulling on the head.',
    golf: 'Single-strap bag carrying loads one upper trap all day. Use both straps or a push cart.'
  },
  {
    id: 'wallsit', name: 'Wall sit', areas: ['knee'], type: 'strength', pose: 'wallSit',
    secs: 40, sides: false, reps: 'Hold 30 to 45 seconds', where: 'home', gear: 'A wall',
    why: 'Quad endurance for the lead leg, which has to brace against rotation at impact.',
    steps: [
      'Back flat on a wall, feet forward, slide down until the thighs are near parallel to the floor.',
      'Knees over the ankles, not past the toes.',
      'Hold. Breathe.',
      'Stand up by pushing through the heels.'
    ],
    cue: 'Press the lower back into the wall.',
    avoid: 'Sitting so deep the knees hurt.',
    golf: 'Also builds the leg stamina for walking hilly courses without the swing falling apart on the back nine.'
  },
  {
    id: 'calfraise', name: 'Calf raises', areas: ['knee'], type: 'strength', pose: 'calfRaise',
    secs: 40, sides: false, reps: '15 slow reps', where: 'course', gear: 'Something to hold',
    why: 'Strong calves stabilise the ankle and knee on uneven lies and reduce the twist through the lead knee.',
    steps: [
      'Stand tall holding a support lightly.',
      'Rise onto the balls of the feet as high as you can.',
      'Pause at the top for a second.',
      'Lower slowly over three seconds.'
    ],
    cue: 'Up fast, down slow. Weight through the big toe.',
    avoid: 'Rolling onto the outside of the foot.',
    golf: 'Great on the first tee while waiting for the group ahead.'
  },
  {
    id: 'childs', name: 'Child’s pose with side reach', areas: ['lowback', 'upback'], type: 'stretch', pose: 'childsPose',
    secs: 40, sides: true, reps: 'Hold 40 seconds each side', where: 'home', gear: 'Floor',
    why: 'Decompresses the lower back after a round and stretches the lats, which pull on the lower back when they are tight.',
    steps: [
      'Kneel, sit the hips back onto the heels, and walk the hands forward until the chest lowers.',
      'Walk both hands over to one side to open the opposite side of the trunk.',
      'Breathe into the back of the ribs. Hold.',
      'Walk the hands to the other side.'
    ],
    cue: 'Long spine, heavy hips.',
    avoid: 'Forcing it if the knees complain. Put a cushion behind them.',
    golf: 'Tight lats limit the arms-overhead position of the backswing and drag the lower back into an arch.'
  },
  {
    id: 'kneeside', name: 'Knees side to side', areas: ['lowback', 'hip'], type: 'mobility', pose: 'kneesSide',
    secs: 45, sides: false, reps: '10 each way', where: 'home', gear: 'Floor',
    why: 'Gentle rotation for a lower back that is sore but not injured. Good on the evening after a round.',
    steps: [
      'Lie on your back, knees bent, feet flat, arms out to the sides.',
      'Let both knees fall slowly to one side, keeping the shoulders on the floor.',
      'Pause where it feels good, breathe out, and bring them back.',
      'Go to the other side.'
    ],
    cue: 'Let gravity do it. No pushing.',
    avoid: 'Any sharp catch. Reduce the range or skip it.',
    golf: 'If one side is much stiffer than the other, that is the side your swing has been overusing.'
  },
  {
    id: 'hamstring', name: 'Standing hamstring stretch', areas: ['hip', 'lowback', 'knee'], type: 'stretch', pose: 'hamstringStand',
    secs: 30, sides: true, reps: 'Hold 30 seconds each leg', where: 'course', gear: 'Step, bench or cart',
    why: 'Tight hamstrings tuck the pelvis under at address (C-posture) and pull on the lower back after walking.',
    steps: [
      'Put one heel up on a step, bench or the cart, leg straight.',
      'Stand tall, then hinge forward from the hips with a flat back.',
      'Stop when you feel the back of the thigh.',
      'Hold. Keep the standing knee soft.'
    ],
    cue: 'Push the chest toward the toes, not the head toward the knee.',
    avoid: 'Rounding the back to get closer.',
    golf: 'You want hamstrings long enough to hinge at the hips with a neutral spine. This is how you get there.'
  },
  {
    id: 'latstretch', name: 'Cart lat stretch', areas: ['upback', 'shoulder', 'lowback'], type: 'stretch', pose: 'latStretch',
    secs: 30, sides: false, reps: 'Hold 30 seconds, then 20 each side', where: 'course', gear: 'Cart, rail or post',
    why: 'Decompresses the spine and stretches the lats after a round. Feels wonderful.',
    steps: [
      'Hold the cart handle or a rail with both hands, arms straight.',
      'Sit the hips back and let the chest drop between the arms.',
      'Let the spine lengthen. Breathe out.',
      'Shift the hips to one side to feel it more down the opposite side.'
    ],
    cue: 'Hang from the arms. Let the back go long.',
    avoid: 'Shrugging the shoulders to the ears.',
    golf: 'Do this before you get in the car. Then the drive home does not lock everything in place.'
  },
  {
    id: 'crossbody', name: 'Cross-body shoulder stretch', areas: ['shoulder'], type: 'stretch', pose: 'crossBody',
    secs: 25, sides: true, reps: 'Hold 25 seconds each arm', where: 'course', gear: 'None',
    why: 'Stretches the back of the shoulder, which gets loaded when the lead arm swings across the chest.',
    steps: [
      'Bring one arm straight across the chest.',
      'Use the other arm to hug it in gently, keeping the shoulder down.',
      'Hold. Breathe.',
      'Swap.'
    ],
    cue: 'Keep the stretched shoulder down, away from the ear.',
    avoid: 'Pulling at the elbow joint itself.',
    golf: 'The lead shoulder crosses the chest on every backswing. Keep the back of it supple.'
  },
  {
    id: 'sleeper', name: 'Sleeper stretch', areas: ['shoulder'], type: 'stretch', pose: 'sleeper',
    secs: 30, sides: true, reps: 'Hold 30 seconds each side', where: 'home', gear: 'Floor',
    why: 'Restores internal rotation of the shoulder, which the trail shoulder loses over years of swinging.',
    steps: [
      'Lie on your side with the bottom arm straight out in front, elbow bent 90 degrees, forearm pointing up.',
      'Use the top hand to gently press the forearm down toward the floor.',
      'Stop at a firm stretch at the back of the shoulder, not pain.',
      'Hold.'
    ],
    cue: 'Keep the shoulder blade pinned to the floor.',
    avoid: 'Rolling the body back to get further.',
    golf: 'A trail shoulder that cannot rotate inward stops the follow-through short and stresses the cuff.'
  },
  {
    id: 'stepback', name: 'Standing hip flexor step-back', areas: ['hip', 'lowback'], type: 'stretch', pose: 'stepBack',
    secs: 25, sides: true, reps: 'Hold 25 seconds each side', where: 'course', gear: 'None',
    why: 'The on-course version of the hip flexor stretch. Do it on the tee while you wait.',
    steps: [
      'Step one foot back into a long stance, both feet pointing forward.',
      'Squeeze the back glute and tuck the tailbone under.',
      'Reach the same-side arm up and slightly across.',
      'Feel the front of the back hip. Hold.'
    ],
    cue: 'Tuck and squeeze first, then reach.',
    avoid: 'Arching the lower back to feel more.',
    golf: 'Lower back stiffening on the back nine is often just the hip flexors shortening as you tire. This resets them.'
  },
  {
    id: 'hipairplane', name: 'Hip airplane', areas: ['hip'], type: 'stability', pose: 'hipAirplane',
    secs: 40, sides: true, reps: '6 slow reps each leg', where: 'home', gear: 'None, a wall for balance',
    why: 'Advanced hip control. Trains the standing hip to rotate under a stable trunk, which is the lead hip’s job through impact.',
    steps: [
      'Stand on one leg and hinge forward into a single-leg deadlift position, arms out for balance.',
      'Keeping the spine still, rotate the pelvis open, so the free hip turns toward the ceiling.',
      'Then rotate it closed, free hip turning toward the floor.',
      'The standing hip does all the rotating.'
    ],
    cue: 'Turn the pelvis like a dial around the standing leg.',
    avoid: 'Twisting the trunk instead of the hip. Hold a wall if wobbly.',
    golf: 'Hip rotation you can control under load is the difference between a hip turn and a hip slide.'
  },
  {
    id: 'gripsqueeze', name: 'Grip squeeze holds', areas: ['elbow', 'wrist'], type: 'strength', pose: 'squeeze',
    secs: 30, sides: false, reps: '5 squeezes of 5 seconds each hand', where: 'course', gear: 'A ball, a towel, or nothing',
    why: 'Isometric holds calm elbow tendon pain quickly and build grip endurance for the back nine.',
    steps: [
      'Squeeze a golf ball, a rolled towel or just your fist at about 70 percent effort.',
      'Hold five seconds. Elbow straight, wrist neutral.',
      'Relax fully for five seconds.',
      'Repeat five times each hand.'
    ],
    cue: 'Firm, not maximal. Breathe.',
    avoid: 'Sharp pain at the elbow. Ease off the effort.',
    golf: 'A common trick before a round when the elbow is grumbling: isometrics dial the pain down for an hour or two.'
  },
  {
    id: 'chest', name: 'Chest opener on the cart', areas: ['shoulder', 'upback'], type: 'stretch', pose: 'doorway',
    secs: 30, sides: true, reps: 'Hold 30 seconds each side', where: 'course', gear: 'Cart, post or doorway',
    why: 'Opens the front of the shoulder and chest, which round forward after a round and after a day at a desk.',
    steps: [
      'Place a forearm on the cart frame or a post, elbow at shoulder height.',
      'Step forward with the same-side foot and turn the chest gently away.',
      'Feel it across the front of the chest and shoulder.',
      'Hold.'
    ],
    cue: 'Turn the chest, not the arm.',
    avoid: 'Shrugging or forcing the shoulder forward.',
    golf: 'Open chest, tall posture, fuller turn. Tight pecs are a hidden cause of C-posture.'
  }
];

const EX = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

/* Routines. steps: exercise id + seconds per block. If the exercise has sides, the block runs twice. */
const ROUTINES = [
  {
    id: 'warmup', name: 'First-tee warm-up', minutes: 7, where: 'course', tone: 'go',
    tagline: 'Standing only. Car park to first tee in seven minutes.',
    steps: [
      { ex: 'legswing', secs: 30 }, { ex: 'stepback', secs: 20 }, { ex: 'wgs', secs: 40 },
      { ex: 'clubrot', secs: 45 }, { ex: 'armcircles', secs: 30 }, { ex: 'ohsquat', secs: 40 },
      { ex: 'hinge', secs: 30 }, { ex: 'wristrot', secs: 30 }, { ex: 'pswings', secs: 75 }
    ]
  },
  {
    id: 'cooldown', name: 'Post-round cool-down', minutes: 6, where: 'course', tone: 'calm',
    tagline: 'Before you get in the car. Six minutes at the cart.',
    steps: [
      { ex: 'hamstring', secs: 30 }, { ex: 'stepback', secs: 30 }, { ex: 'figure4', secs: 30 },
      { ex: 'latstretch', secs: 30 }, { ex: 'crossbody', secs: 25 }, { ex: 'wristflex', secs: 20 },
      { ex: 'wristext', secs: 20 }, { ex: 'clubrot', secs: 30 }
    ]
  },
  {
    id: 'daily', name: 'Daily back care', minutes: 10, where: 'home', tone: 'calm',
    tagline: 'Floor work. The routine that keeps the lower back out of trouble.',
    steps: [
      { ex: 'catcow', secs: 60 }, { ex: 'openbook', secs: 45 }, { ex: 'hip9090', secs: 60 },
      { ex: 'hipflexor', secs: 30 }, { ex: 'deadbug', secs: 60 }, { ex: 'birddog', secs: 60 },
      { ex: 'sideplank', secs: 25 }, { ex: 'bridge', secs: 60 }, { ex: 'childs', secs: 40 }
    ]
  },
  {
    id: 'tspine', name: 'Mid-back unlock', minutes: 6, where: 'home', tone: 'calm',
    tagline: 'For desk-stiff golfers. More turn from the ribs, less from the lumbar spine.',
    steps: [
      { ex: 'openbook', secs: 45 }, { ex: 'thread', secs: 40 }, { ex: 'text', secs: 45 },
      { ex: 'wallangel', secs: 45 }, { ex: 'clubrot', secs: 45 }, { ex: 'childs', secs: 40 }
    ]
  },
  {
    id: 'elbow', name: 'Elbow and forearm rehab', minutes: 6, where: 'home', tone: 'calm',
    tagline: 'Daily for six weeks. Golfer’s elbow, tennis elbow and sore wrists.',
    steps: [
      { ex: 'wristflex', secs: 30 }, { ex: 'wristext', secs: 30 }, { ex: 'eccwrist', secs: 60 },
      { ex: 'pronation', secs: 40 }, { ex: 'gripsqueeze', secs: 30 }
    ]
  },
  {
    id: 'strength', name: 'Golf strength basics', minutes: 10, where: 'home', tone: 'go',
    tagline: 'Twice a week. Glutes, legs, trunk and rotator cuff.',
    steps: [
      { ex: 'bridge', secs: 60 }, { ex: 'slrdl', secs: 40 }, { ex: 'splitsquat', secs: 40 },
      { ex: 'sideplank', secs: 30 }, { ex: 'pallof', secs: 40 }, { ex: 'bander', secs: 40 },
      { ex: 'ytw', secs: 60 }, { ex: 'hipairplane', secs: 40 }, { ex: 'calfraise', secs: 40 }
    ]
  },
  {
    id: 'turn', name: 'Between-holes reset', minutes: 1.5, where: 'course', tone: 'go',
    tagline: 'Ninety seconds while the group ahead clears the green.',
    steps: [
      { ex: 'clubrot', secs: 30 }, { ex: 'stepback', secs: 20 }, { ex: 'chintuck', secs: 20 }
    ]
  }
];

const ROUTINE = Object.fromEntries(ROUTINES.map(r => [r.id, r]));

/* ---------- Symptom planner ---------- */

const TIMINGS = {
  during:  { label: 'During the round',   hint: 'Comes on while swinging or walking' },
  after:   { label: 'After the round',    hint: 'Fine on the course, sore that evening' },
  morning: { label: 'The next morning',   hint: 'Stiff and sore when I get up' },
  constant:{ label: 'Most of the time',   hint: 'There whether I play or not' }
};

const FEELS = {
  stiff: { label: 'Stiff and achy',        hint: 'Dull, spread out, eases with movement' },
  sharp: { label: 'Sharp on one movement', hint: 'Catches on a specific move or position' },
  nerve: { label: 'Shooting, tingling or numb', hint: 'Travels down a limb, pins and needles, weakness' }
};

/* Level: play (green) / drop (amber) / pickup (red) */
const LEVELS = {
  play:   { label: 'Play on',      sub: 'Keep playing. Do the plan and change the habit that caused it.' },
  drop:   { label: 'Take a drop',  sub: 'Ease off for three to five days. Do the gentle plan, then build back.' },
  pickup: { label: 'Pick up',      sub: 'Do not play through this. Get it looked at by a doctor or physio.' }
};

function assessLevel(area, timing, feel) {
  if (feel === 'nerve') return 'pickup';
  if (feel === 'sharp') return 'drop';
  if (timing === 'constant') return 'drop';
  return 'play';
}

const PLANS = {
  lowback: {
    intro: 'Lower back pain is the most common golf injury. Around one golfer in three deals with it in a given season. The swing puts roughly eight times your body weight of compression through the lumbar spine and asks it to bend sideways and twist at the same time.',
    key: 'The lumbar spine is built to rotate about 13 degrees in total. A full swing needs a trunk turn of 90 degrees or more. The rest has to come from the hips and the mid back. When those are stiff, the lower back does work it was never designed for.',
    timing: {
      during:  'Pain that shows up mid-swing points to the swing itself, usually the lower back rotating or side-bending too much because the hips or mid back are not moving. Have someone check your top-of-backswing position for a lean toward the target (reverse spine angle).',
      after:   'Fine on the course but sore that evening usually means the tissues coped with the round but not with the total load: four hours of posture, 60 bends to the ball, carrying a bag, then sitting in the car. The cool-down and how you handle the bag matter here.',
      morning: 'Morning stiffness after golf is typical of joint and disc irritation reacting overnight. It usually eases with gentle movement within an hour. Pelvic tilts and a short walk before anything else.',
      constant:'Pain that is there whether or not you play needs a proper look. Golf may be aggravating something rather than causing it. Book a physio or doctor, and keep to the gentle plan in the meantime.'
    },
    feel: {
      stiff: ['pelvictilt', 'catcow', 'kneeside', 'hip9090', 'hipflexor', 'birddog', 'bridge', 'childs'],
      sharp: ['pelvictilt', 'curlup', 'birddog', 'sideplank', 'hipflexor', 'childs'],
      nerve: ['pelvictilt', 'kneeside']
    },
    daily: 'daily',
    faults: ['reverse', 'sposture', 'earlyext', 'hangback'],
    avoid: [
      'Long range sessions, especially on mats, until it settles. Fifty balls hit fast is 50 swings with no recovery between them.',
      'Carrying the bag on one shoulder. Use both straps or a push cart.',
      'Bending from the waist to tee up or retrieve the ball. Squat or use the golfer’s pickup.',
      'Sitting in the car straight after the round without the cool-down.',
      'Driver off every tee. Take a fairway wood or iron on holes where it does not matter.'
    ],
    see: [
      'Pain, tingling or numbness that travels below the knee.',
      'Weakness in a leg or foot, or a foot that slaps or drags.',
      'Any change in bladder or bowel control, or numbness around the groin. This is urgent.',
      'Pain that wakes you at night or does not change with position.',
      'Pain after a fall or heavy lift, or if you are over 60 and this is new.',
      'No improvement after two weeks of the plan.'
    ]
  },
  upback: {
    intro: 'Mid and upper back pain in golfers is almost always a stiffness problem rather than an injury. The thoracic spine is where a good turn should come from, and modern life locks it up.',
    key: 'Each of the 12 thoracic vertebrae should contribute a few degrees of rotation, adding up to around 35 degrees each way. Sit at a desk for ten years and that drops by half. The swing then borrows the missing rotation from the lumbar spine and the neck.',
    timing: {
      during:  'A pinch between the shoulder blades on the backswing is the classic stiff-thoracic complaint. The trail-side ribs run out of room and the joints get jammed at the top.',
      after:   'Aching across the shoulders after a round is usually the postural muscles fatiguing from four hours of holding a forward-tilted trunk, plus the bag.',
      morning: 'Morning stiffness across the mid back eases quickly with movement. Open books before you even get out of bed work well.',
      constant:'Constant mid-back pain is unusual from golf alone. Rib joints, posture and even breathing patterns can play a part. Worth a professional look.'
    },
    feel: {
      stiff: ['openbook', 'thread', 'text', 'wallangel', 'clubrot', 'childs', 'latstretch'],
      sharp: ['catcow', 'openbook', 'text', 'ytw', 'chest'],
      nerve: ['openbook', 'catcow']
    },
    daily: 'tspine',
    faults: ['cposture', 'flatshoulder', 'reverse'],
    avoid: [
      'Forcing a longer backswing. Turn as far as the mid back allows, then work on the mobility.',
      'Single-strap carrying.',
      'Slumping in the cart between shots.'
    ],
    see: [
      'Pain that wraps around the ribs to the front of the chest.',
      'Chest pain, breathlessness or pain that appears with exertion rather than movement. Seek urgent care.',
      'Numbness or tingling into the arms.',
      'Pain that does not improve after two weeks of daily mobility work.'
    ]
  },
  neck: {
    intro: 'The neck works hard in golf. You hold the head still over the ball while the shoulders turn 90 degrees underneath it, which means the cervical spine rotates almost the whole way on every swing.',
    key: 'Most golf neck pain comes from three things: a jutting chin at address, a stiff mid back forcing the neck to do the turning, and a bag strap on one shoulder for four hours.',
    timing: {
      during:  'Pain at the top of the backswing or on the follow-through means the neck is being asked for rotation the mid back should provide. Work on the thoracic spine and check your chin position at address.',
      after:   'A stiff, tired neck after the round is usually the upper traps and the bag. Cool down and change how you carry.',
      morning: 'Morning neck stiffness often has as much to do with the pillow as the golf. Gentle chin tucks and shoulder rolls before you get up.',
      constant:'Constant neck pain, or headaches that start at the base of the skull, deserve a proper assessment.'
    },
    feel: {
      stiff: ['chintuck', 'neckstretch', 'openbook', 'text', 'wallangel', 'chest'],
      sharp: ['chintuck', 'openbook', 'text'],
      nerve: ['chintuck']
    },
    daily: 'tspine',
    faults: ['cposture', 'flatshoulder'],
    avoid: [
      'Jamming the chin into the chest at address. Keep it up so the shoulders can turn under it.',
      'Single-strap carrying.',
      'Cranking the head round to watch the ball on the follow-through; let the whole body turn to face the target instead.'
    ],
    see: [
      'Tingling, numbness or weakness in an arm or hand.',
      'Pain after any impact or fall.',
      'Dizziness, visual changes or headaches with the neck pain.',
      'No improvement after two weeks.'
    ]
  },
  shoulder: {
    intro: 'The lead shoulder (left for a right-handed golfer) is stretched across the chest at the top of the backswing, and the trail shoulder rotates hard outward. Both rely on the rotator cuff, a set of small muscles that keep the ball of the joint centred.',
    key: 'Shoulder pain in golfers is mostly rotator cuff irritation and impingement, usually in the lead shoulder, made worse by a stiff mid back forcing the arms to make up the turn.',
    timing: {
      during:  'Pain at the top of the backswing in the lead shoulder, or in the follow-through in the trail shoulder, is the classic pattern. Shorten the swing a fraction and improve the trunk turn so the shoulders do less.',
      after:   'Aching after the round with no specific moment of pain is usually cuff fatigue. Strengthen it.',
      morning: 'Shoulder pain that is worse at night or first thing, especially lying on it, is typical of cuff tendon irritation.',
      constant:'A shoulder that is constantly painful or losing range (you cannot reach up or behind) needs assessment. Frozen shoulder is common in the golfing age group.'
    },
    feel: {
      stiff: ['armcircles', 'crossbody', 'sleeper', 'wallangel', 'openbook', 'bander', 'ytw'],
      sharp: ['bander', 'ytw', 'wallangel', 'openbook'],
      nerve: ['chintuck', 'openbook']
    },
    daily: 'tspine',
    faults: ['cposture', 'chickenwing', 'flatshoulder'],
    avoid: [
      'Over-swinging past the point where the trunk stops turning.',
      'Heavy overhead lifting or pressing while it is sore.',
      'Sleeping on the sore shoulder.'
    ],
    see: [
      'You cannot lift the arm, or it feels weak rather than just sore.',
      'A fall onto the shoulder, or a pop at the moment of injury.',
      'Night pain that wakes you regularly.',
      'Steady loss of range over weeks.'
    ]
  },
  hip: {
    intro: 'The lead hip rotates inward hard through impact, absorbing most of the rotational load of the downswing. The trail hip does the same on the backswing. Hip problems in golfers are usually a lack of rotation, and the lower back is the first to complain about it.',
    key: 'Pain in the groin or deep in the front of the hip usually means the joint itself is running out of rotation. Pain on the outside or in the buttock is usually the muscles and tendons around it.',
    timing: {
      during:  'Groin pain through impact in the lead hip, or trail-hip pain at the top of the backswing, both point to limited internal rotation. Improve it, and shorten the swing a little in the meantime.',
      after:   'Outside-hip or buttock ache after walking 18 holes is typically the glutes and their tendons. Strengthen and stretch them.',
      morning: 'Morning hip stiffness that eases in the first half hour is common in the over-50s. Keep moving. 90/90 switches most days.',
      constant:'Constant groin pain, especially with clicking or catching, should be assessed. Early hip arthritis and labral problems are both common in lifelong golfers and both respond well to the right plan.'
    },
    feel: {
      stiff: ['legswing', 'hip9090', 'hipflexor', 'figure4', 'bridge', 'slrdl', 'hipairplane'],
      sharp: ['bridge', 'sideplank', 'hipflexor', 'figure4'],
      nerve: ['kneeside', 'hipflexor']
    },
    daily: 'daily',
    faults: ['sway', 'slide', 'earlyext'],
    avoid: [
      'Forcing the hip turn through a groin pinch. Reduce the range and work the mobility.',
      'Long stretches of sitting straight after a round.',
      'Deep squatting under load while the groin is sore.'
    ],
    see: [
      'Groin pain with clicking, catching or locking.',
      'Pain that wakes you at night.',
      'A limp that does not settle in a day or two.',
      'Numbness, tingling or pain that shoots down the leg (this is usually the back, not the hip).'
    ]
  },
  elbow: {
    intro: 'Golfer’s elbow (inside) and tennis elbow (outside) are both tendon overload from gripping and from the shock of the club meeting the ground. Despite the name, the outside kind is more common in golfers, and it usually hits the lead arm.',
    key: 'Tendons adapt slowly. The fix is not rest but the right kind of loading: slow eccentric strengthening, daily, for about six weeks, plus taking the sudden shocks out of your golf.',
    timing: {
      during:  'Pain at impact, especially on fat shots, is the tendon being shocked. Check the grip pressure (aim for four out of ten), avoid hard mats, and use the isometric holds before the round to calm it.',
      after:   'Elbow ache that builds after the round is classic tendon overload. Start the rehab routine tonight and keep going after it stops hurting.',
      morning: 'Morning stiffness in the elbow that eases as you use it is typical of a tendon in the irritable phase.',
      constant:'Constant elbow pain, or pain when gripping a mug or turning a key, means the tendon is well and truly irritated. Rehab works but it takes weeks; be patient with it.'
    },
    feel: {
      stiff: ['wristflex', 'wristext', 'eccwrist', 'pronation', 'gripsqueeze', 'wristrot'],
      sharp: ['gripsqueeze', 'eccwrist', 'wristflex', 'wristext'],
      nerve: ['wristflex', 'chintuck']
    },
    daily: 'elbow',
    faults: ['casting', 'chickenwing'],
    avoid: [
      'Strangling the club. If your knuckles whiten you are gripping too hard.',
      'Hitting from firm range mats. Use grass or a softer mat.',
      'A grip that is too small for your hands, which makes you squeeze harder. Get it checked.',
      'Sudden jumps in volume, like a golf trip after a quiet winter.'
    ],
    see: [
      'Numbness or tingling in the ring and little fingers (the ulnar nerve runs behind the inside of the elbow).',
      'The elbow locking or catching.',
      'Swelling, redness or warmth over the joint.',
      'No change after six weeks of daily rehab.'
    ]
  },
  wrist: {
    intro: 'The lead wrist takes the impact with the ball and the ground; the trail hand takes the butt of the club against the palm. Wrist and hand injuries in golf are usually either overuse of the tendons or a single bad shot out of thick rough or off a root.',
    key: 'Most wrist pain in golfers settles with a lighter grip, a warm-up and a couple of weeks of care. Pain at the base of the trail palm that will not go away is the exception and needs an x-ray.',
    timing: {
      during:  'Pain at impact in the lead wrist, especially out of the rough, is the tendons on the thumb side being jarred. Warm up, hold the club a little lighter, and take your medicine out of deep rough with a wedge.',
      after:   'Ache in the wrist and forearm after the round is tendon overload. The elbow rehab routine covers it.',
      morning: 'Morning wrist stiffness is common in golfers with some arthritis in the hand. Warm water and gentle circles before the round.',
      constant:'Constant wrist pain, especially at the little-finger side of the wrist or the heel of the trail hand, needs a proper look.'
    },
    feel: {
      stiff: ['wristrot', 'wristflex', 'wristext', 'pronation', 'gripsqueeze'],
      sharp: ['wristrot', 'gripsqueeze', 'wristflex'],
      nerve: ['wristflex', 'chintuck']
    },
    daily: 'elbow',
    faults: ['casting'],
    avoid: [
      'Hitting from firm mats or hard-pan lies while it is sore.',
      'Full swings out of thick rough. Take a wedge and get it back in play.',
      'Practising with a very heavy training club.'
    ],
    see: [
      'Pain and tenderness at the base of the palm of the trail hand (below the little finger) that persists. This can be a hook of hamate fracture, a golf-specific injury that needs an x-ray or CT.',
      'Clicking or a feeling of instability on the little-finger side of the wrist.',
      'Swelling, or numbness in the fingers.',
      'A single bad shot that caused a sharp pain that is not settling after a few days.'
    ]
  },
  knee: {
    intro: 'The lead knee takes a sudden twisting and straightening load through impact, and both knees do a lot of quiet work walking hilly courses. Knee pain in golfers is usually the front of the knee (kneecap) or the inside (meniscus and the joint line).',
    key: 'The knee is a hinge that is asked to twist. Strong hips and calves take the twist for it. Softer spikes, a slightly more flared lead foot and not locking the lead knee at impact all help.',
    timing: {
      during:  'Pain in the lead knee at impact or the follow-through points to the rotational load. Flare the lead foot out 20 to 30 degrees at address and let the lead heel come up a little in the finish.',
      after:   'Knee ache after walking the course is usually the kneecap and the quads fatiguing. Strengthen the legs; wall sits and split squats.',
      morning: 'Morning knee stiffness that improves as you move is common with wear and tear. Keep walking and keep the legs strong.',
      constant:'Constant knee pain with swelling or a feeling of the knee giving way needs assessment.'
    },
    feel: {
      stiff: ['legswing', 'hamstring', 'splitsquat', 'wallsit', 'calfraise', 'bridge'],
      sharp: ['wallsit', 'calfraise', 'bridge', 'hamstring'],
      nerve: ['hamstring', 'kneeside']
    },
    daily: 'strength',
    faults: ['sway', 'slide', 'hangback'],
    avoid: [
      'Locking the lead knee straight at impact. Keep a little softness.',
      'Metal or aggressive spikes, which anchor the foot and send the twist into the knee.',
      'Riding in a cart to save the knee but then walking on steep slopes cold.'
    ],
    see: [
      'Swelling, especially within a few hours of an injury.',
      'Locking, catching or the knee giving way.',
      'Inability to fully straighten or bend the knee.',
      'Pain that stops you sleeping.'
    ]
  }
};

/* ---------- Swing faults ---------- */

const FAULTS = [
  {
    id: 'reverse', name: 'Reverse spine angle',
    what: 'At the top of the backswing the upper body leans toward the target instead of slightly away from it.',
    body: 'Usually caused by hips that cannot turn, a stiff mid back, or a weak trunk that cannot hold posture as the club goes back.',
    risk: 'The single swing characteristic most strongly linked to lower back pain. It loads the trail-side lumbar joints on the way back and then forces the lower back to unwind first on the way down.',
    fix: ['hip9090', 'openbook', 'clubrot', 'hinge', 'sideplank'],
    drill: 'Set up with your head just behind the ball and keep it there to the top. Feel your trail hip sit back and your chest turn over the trail leg, not toward the target.'
  },
  {
    id: 'sposture', name: 'S-posture',
    what: 'An exaggerated arch in the lower back at address, with the tailbone sticking out.',
    body: 'Tight hip flexors and weak glutes and abdominals tip the pelvis forward.',
    risk: 'Jams the lumbar facet joints before the swing even begins and switches the deep core off. Every swing then starts from a compromised position.',
    fix: ['hipflexor', 'pelvictilt', 'deadbug', 'bridge', 'hinge'],
    drill: 'At address, tuck the tailbone gently under until the belt buckle points at the ball rather than the ground. Feel the abs switch on.'
  },
  {
    id: 'cposture', name: 'C-posture',
    what: 'Rounded shoulders and a hunched upper back at address, so the spine forms a C from the side.',
    body: 'Desk posture: tight chest, stiff mid back, weak muscles between the shoulder blades.',
    risk: 'A rounded thoracic spine cannot rotate. The backswing turn gets cut short and the lower back and neck make up the difference.',
    fix: ['text', 'wallangel', 'ytw', 'chest', 'openbook'],
    drill: 'Stand tall, then hinge from the hips with the chest proud. Use the club-along-the-spine check: head, mid back and tailbone all touching.'
  },
  {
    id: 'earlyext', name: 'Early extension',
    what: 'The hips thrust toward the ball in the downswing and the body stands up out of its posture.',
    body: 'Stiff hips, stiff ankles, weak glutes, or an inability to squat with heels down.',
    risk: 'Forces the spine to extend and side-bend under load through impact, and is a common source of both lower back and lead hip pain.',
    fix: ['ohsquat', 'hip9090', 'bridge', 'hipairplane', 'hinge'],
    drill: 'Set up with your bum touching a chair or the bag. Keep it touching through impact.'
  },
  {
    id: 'sway', name: 'Sway',
    what: 'The hips slide sideways away from the target in the backswing instead of turning.',
    body: 'The trail hip cannot rotate inward, so it slides instead.',
    risk: 'Makes it hard to get back to the ball, and the compensation is usually a hard lateral bend of the lower back through impact.',
    fix: ['hip9090', 'legswing', 'hipairplane', 'figure4'],
    drill: 'Put an alignment stick in the ground just outside the trail hip. Turn the backswing without touching it.'
  },
  {
    id: 'slide', name: 'Slide',
    what: 'The hips slide toward the target in the downswing rather than rotating around the lead hip.',
    body: 'The lead hip cannot rotate inward, or the lead leg is too weak to post up against.',
    risk: 'Sends shear force through the lower back and rotational load into the lead knee.',
    fix: ['hip9090', 'splitsquat', 'slrdl', 'hipairplane', 'sideplank'],
    drill: 'Feel the lead hip turn back and away from the ball in the downswing, as if someone is pulling your lead pocket behind you.'
  },
  {
    id: 'hangback', name: 'Hanging back',
    what: 'Weight stays on the trail foot through impact and the body leans away from the target.',
    body: 'Poor weight shift, stiff lead hip, or weak lead leg.',
    risk: 'Creates an extreme reverse-C finish that compresses the lower back on every swing.',
    fix: ['splitsquat', 'slrdl', 'bridge', 'hip9090'],
    drill: 'Finish every practice swing with the trail foot up on its toe and the belt buckle facing the target. Hold it for three seconds.'
  },
  {
    id: 'flatshoulder', name: 'Flat shoulder plane',
    what: 'The shoulders turn level with the ground in the backswing instead of tilting, so the body comes up out of posture.',
    body: 'Stiff mid back, or a neck that will not let the shoulders turn under the chin.',
    risk: 'Loses posture, which the lower back then has to recover at speed on the downswing. Also loads the neck.',
    fix: ['openbook', 'clubrot', 'chintuck', 'text', 'thread'],
    drill: 'Club across the shoulders in posture. Turn so the lead end of the club points at the ball at the top.'
  },
  {
    id: 'chickenwing', name: 'Chicken wing',
    what: 'The lead elbow bends and points at the target through impact.',
    body: 'Limited lead shoulder rotation, tight lats, or a lead arm bracing against the club.',
    risk: 'Loads the lead elbow and shoulder with every strike.',
    fix: ['crossbody', 'latstretch', 'sleeper', 'bander', 'wristext'],
    drill: 'Hold a headcover under the lead armpit and keep it there through impact and into the follow-through.'
  },
  {
    id: 'casting', name: 'Casting',
    what: 'The wrists unhinge too early in the downswing, throwing the clubhead at the ball.',
    body: 'Often a grip that is too tight, weak forearms, or a body that stops turning so the hands take over.',
    risk: 'Fat and thin shots, and the shock of both goes straight into the elbows and wrists.',
    fix: ['pronation', 'eccwrist', 'gripsqueeze', 'clubrot'],
    drill: 'Grip pressure four out of ten. Feel the hands stay passive as the body turns through.'
  }
];

const FAULT = Object.fromEntries(FAULTS.map(f => [f.id, f]));

/* ---------- Injury guide ---------- */

const INJURIES = [
  {
    id: 'lowback', name: 'Lower back', stat: 'Around 1 in 3 golfers each season',
    why: 'The lumbar spine is asked to twist and side-bend under eight times body weight of compression, 80 to 100 times a round, then to bend forward another 60 times to the ball.',
    faults: ['reverse', 'sposture', 'earlyext', 'hangback'],
    habits: ['Warm up before the first tee', 'Both straps or a push cart', 'Golfer’s pickup, not a waist bend', 'Cool down before the drive home', 'Daily back care three times a week'],
    routine: 'daily'
  },
  {
    id: 'elbow', name: 'Elbow', stat: 'Second most common, especially in golfers over 45',
    why: 'Gripping hard and the shock of the club striking the ground overload the tendons that anchor the forearm muscles to the elbow. The outside (tennis elbow) is more common in golfers than the inside (golfer’s elbow).',
    faults: ['casting', 'chickenwing'],
    habits: ['Grip pressure four out of ten', 'Grass over hard mats', 'Warm the forearms before the range', 'Eccentric wrist curls daily when it flares', 'Check grip size'],
    routine: 'elbow'
  },
  {
    id: 'shoulder', name: 'Shoulder', stat: 'Mostly the lead shoulder, mostly the rotator cuff',
    why: 'The lead arm is pulled across the chest at the top and the trail shoulder is rotated hard outward. A stiff mid back makes the shoulders do more of the turn than they should.',
    faults: ['cposture', 'chickenwing', 'flatshoulder'],
    habits: ['Turn from the trunk, not the arms', 'Band external rotations twice a week', 'Do not force the backswing longer', 'Sleep off the sore side'],
    routine: 'strength'
  },
  {
    id: 'wrist', name: 'Wrist and hand', stat: 'Common in players who hit a lot of balls',
    why: 'The lead wrist takes impact with the ground and the rough; the trail palm takes the butt of the club. Thick rough, roots and hard mats are the usual culprits.',
    faults: ['casting'],
    habits: ['Lighter grip', 'Wedge out of deep rough', 'Warm up the wrists before hitting', 'See someone about trail-palm pain that lingers'],
    routine: 'elbow'
  },
  {
    id: 'hip', name: 'Hip', stat: 'Rising fast in golfers over 50',
    why: 'The lead hip rotates inward violently through impact. Golfers with limited hip rotation slide and sway, and the load moves to the joint surfaces and the lower back.',
    faults: ['sway', 'slide', 'earlyext'],
    habits: ['90/90 switches most days', 'Glute strength twice a week', 'Walk, do not sit, after the round', 'Get groin pain with clicking checked early'],
    routine: 'daily'
  },
  {
    id: 'knee', name: 'Knee', stat: 'Usually the lead knee',
    why: 'A hinge joint asked to twist. The lead knee straightens and rotates at impact, and walking 8 kilometres of undulating course adds up.',
    faults: ['slide', 'hangback', 'sway'],
    habits: ['Soft spikes or spikeless', 'Flare the lead foot slightly', 'Do not lock the lead knee at impact', 'Leg strength twice a week'],
    routine: 'strength'
  },
  {
    id: 'neck', name: 'Neck', stat: 'Common, and often blamed on the pillow',
    why: 'The head stays still while the shoulders turn 90 degrees under it. Add a jutting chin at address and a single bag strap and the neck gets very tired.',
    faults: ['cposture', 'flatshoulder'],
    habits: ['Chin up at address', 'Both straps or a push cart', 'Mid-back mobility so the neck turns less', 'Let the body turn to watch the ball'],
    routine: 'tspine'
  }
];

/* ---------- Round-day habits ---------- */

const HABITS = [
  { when: 'Before', title: 'Warm up. Every time.', text: 'Seven minutes standing in the car park cuts injury risk and adds clubhead speed on the first tee. Practice swings on the tee do not count.' },
  { when: 'Before', title: 'Build up on the range.', text: 'Wedge first, driver last. Twenty balls at increasing speed, not fifty at full tilt.' },
  { when: 'Before', title: 'Check the setup.', text: 'Club along the spine: head, mid back and tailbone all touching. Chin up. Belt buckle at the ball, not the ground.' },
  { when: 'During', title: 'Both straps or push it.', text: 'A single-strap bag loads one side of the spine and neck for four hours. A push cart takes the load off entirely.' },
  { when: 'During', title: 'Pick up like a golfer.', text: 'Hinge on one leg to pick up the ball. Squat to tee it up. Sixty bends a round should never come from the waist.' },
  { when: 'During', title: 'Grip pressure four out of ten.', text: 'A strangled club sends every shock into the elbows. Hold it like a tube of toothpaste with the cap off.' },
  { when: 'During', title: 'Reset at the turn.', text: 'Ninety seconds of club rotations and a hip flexor stretch while the group ahead clears. The back nine will thank you.' },
  { when: 'During', title: 'Drink and eat.', text: 'Dehydrated muscles cramp and tire. Tired muscles stop protecting the spine on the 15th.' },
  { when: 'After', title: 'Cool down before the car.', text: 'Six minutes at the cart. Then the drive home does not lock the round into your lower back.' },
  { when: 'After', title: 'Move that evening.', text: 'A walk, knees side to side, a hot shower. Not the sofa for three hours.' },
  { when: 'Always', title: 'Do the daily back care.', text: 'Ten minutes, three times a week. Mobility for the hips and mid back, stability for the lumbar spine. This is the whole game.' },
  { when: 'Always', title: 'Do not go from zero to 36.', text: 'A golf trip after a quiet winter is the classic injury story. Build volume over three or four weeks first.' },
  { when: 'Always', title: 'Get the reverse spine angle looked at.', text: 'One lesson with a coach who films the swing. It is the number one swing cause of lower back pain and it is fixable.' }
];
