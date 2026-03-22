// Exercise library — comprehensive catalog with modifications and difficulty levels

const EXERCISE_CATALOG = {
  // EXISTING (full state machine in exercise-engine.js)
  squat: {
    name: 'Squats',
    icon: '🦵',
    category: 'strength',
    difficulty: 'beginner',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Core', 'Calves'] },
    equipment: 'none',
    cameraAngles: ['side', 'front', '45deg'],
    bestAngle: 'side',
    angleNotes: {
      side: 'Best for depth and back angle analysis',
      front: 'Best for knee valgus and stance width',
      '45deg': 'Good all-around view, recommended for beginners'
    },
    science: {
      summary: 'The squat is the king of lower body exercises. It activates 200+ muscles simultaneously.',
      muscles: 'Primary movers: quadriceps (vastus lateralis, medialis, intermedius, rectus femoris) and gluteus maximus. Stabilizers: erector spinae, transverse abdominis, adductors.',
      biomechanics: 'Optimal squat depth is when the hip crease drops below the knee (parallel). At 90° knee flexion, the patellofemoral joint experiences ~3.5x bodyweight compression. Below parallel actually distributes force more evenly across the joint (Hartmann et al., 2013).',
      benefits: 'Increases bone density (Wolff\'s Law), boosts testosterone and GH production, improves functional movement patterns. 12-week squat programs increase vertical jump by ~8% (NSCA, 2016).',
      commonMistakes: 'Knee valgus (knees caving) increases ACL strain 3-4x. Forward lean shifts load to lower back. Heel rise indicates tight calves limiting ankle dorsiflexion.'
    },
    modifications: {
      easier: ['Wall squat (slide down wall)', 'Chair squat (sit to chair)', 'Quarter squat (shallow)'],
      harder: ['Goblet squat (hold weight)', 'Jump squat (plyometric)', 'Pistol squat (single leg)']
    }
  },
  pushup: {
    name: 'Push-Ups',
    icon: '💪',
    category: 'strength',
    difficulty: 'beginner',
    muscles: { primary: ['Chest (Pectoralis Major)', 'Triceps'], secondary: ['Anterior Deltoid', 'Core', 'Serratus Anterior'] },
    equipment: 'none',
    cameraAngles: ['side', 'front'],
    bestAngle: 'side',
    angleNotes: {
      side: 'Best for depth and body alignment (hip sag/pike)',
      front: 'Best for elbow flare and hand placement'
    },
    science: {
      summary: 'Push-ups load the chest with ~64% of bodyweight at the bottom position.',
      muscles: 'The pectoralis major (clavicular and sternal heads) is the primary mover. At different hand widths, muscle activation shifts: wide = more pec, narrow = more tricep (Cogley et al., 2005).',
      biomechanics: 'Standard push-up applies ~0.64x bodyweight. Incline (hands elevated) reduces to ~0.41x. Decline (feet elevated) increases to ~0.74x. Each 10° decline increase adds ~5% bodyweight load.',
      benefits: 'Upper body pushing strength, shoulder stability, core endurance. 40+ push-ups correlates with 96% lower cardiovascular disease risk vs <10 (JAMA, 2019).',
      commonMistakes: 'Hip sag increases lumbar spine load. Elbow flare (>45°) increases shoulder impingement risk. Incomplete range of motion reduces muscle activation by 30-40%.'
    },
    modifications: {
      easier: ['Knee push-ups', 'Incline push-ups (hands on bench)', 'Wall push-ups'],
      harder: ['Decline push-ups', 'Diamond push-ups', 'Archer push-ups', 'Clap push-ups']
    }
  },
  plank: {
    name: 'Plank',
    icon: '🧘',
    category: 'core',
    difficulty: 'beginner',
    muscles: { primary: ['Rectus Abdominis', 'Transverse Abdominis'], secondary: ['Obliques', 'Erector Spinae', 'Shoulders', 'Glutes'] },
    equipment: 'none',
    cameraAngles: ['side'],
    bestAngle: 'side',
    angleNotes: {
      side: 'Only reliable angle — shows body alignment from shoulder to ankle'
    },
    science: {
      summary: 'Isometric core exercise. Activates all 4 abdominal layers simultaneously.',
      muscles: 'Transverse abdominis provides the deepest stabilization (like a corset). Rectus abdominis prevents spinal extension. Obliques resist rotation. Erector spinae co-contracts for spinal stability.',
      biomechanics: 'At 60s hold, core muscles reach ~60% maximal voluntary contraction. Diminishing returns after 120s for most people. Side plank activates obliques 2x more than front plank.',
      benefits: 'Reduces lower back pain by strengthening the "core cylinder." Improves posture. Transfers to every other exercise — a weak core is the bottleneck for squat, deadlift, and overhead press.',
      commonMistakes: 'Hip sag loads the lumbar spine. Hip pike reduces core activation. Looking up hyperextends the cervical spine — keep neck neutral.'
    },
    modifications: {
      easier: ['Knee plank', 'Incline plank (hands on bench)', 'Short holds (10-15s)'],
      harder: ['Side plank', 'Plank with arm reach', 'Plank with leg lift', 'Weighted plank']
    }
  },
  lunge: {
    name: 'Lunges',
    icon: '🦿',
    category: 'strength',
    difficulty: 'beginner',
    muscles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Calves', 'Core (balance)'] },
    equipment: 'none',
    cameraAngles: ['side', 'front', '45deg'],
    bestAngle: '45deg',
    angleNotes: {
      side: 'Best for knee angle and torso position',
      front: 'Best for knee alignment and balance',
      '45deg': 'Best overall — captures both knee angle and alignment'
    },
    science: {
      summary: 'Unilateral leg exercise that addresses strength imbalances between legs.',
      muscles: 'Front leg: quadriceps and glutes. Rear leg: hip flexor stretch. Single-leg exercises activate the gluteus medius 40% more than bilateral movements (Boren et al., 2011).',
      biomechanics: 'Longer stride = more glute, shorter stride = more quad. Front knee should track over 2nd-3rd toe. Optimal depth: rear knee 1-2 inches from ground.',
      benefits: 'Corrects left-right imbalances, improves single-leg stability (critical for walking, running, stairs). Reduces fall risk by 30% in older adults when trained 2x/week.',
      commonMistakes: 'Knee past toes with trunk lean forward = excessive patellar tendon load. Lateral knee collapse = valgus stress on MCL/meniscus.'
    },
    modifications: {
      easier: ['Reverse lunge (step back)', 'Stationary lunge (no stepping)', 'Assisted lunge (hold chair)'],
      harder: ['Walking lunge', 'Jump lunge (plyometric)', 'Bulgarian split squat']
    }
  },
  shoulderpress: {
    name: 'Shoulder Press',
    icon: '🏋️',
    category: 'strength',
    difficulty: 'intermediate',
    muscles: { primary: ['Anterior Deltoid', 'Lateral Deltoid'], secondary: ['Triceps', 'Upper Trapezius', 'Serratus Anterior'] },
    equipment: 'dumbbells recommended',
    cameraAngles: ['front', 'side'],
    bestAngle: 'front',
    angleNotes: {
      front: 'Best for symmetry check and lockout verification',
      side: 'Best for overhead path and back arch'
    },
    science: {
      summary: 'Overhead pressing builds functional strength for reaching and lifting above head height.',
      muscles: 'The deltoid has 3 heads — anterior (front), lateral (side), and posterior (rear). Overhead press primarily targets anterior and lateral. Standing press activates core 20% more than seated.',
      biomechanics: 'The subacromial space narrows during overhead pressing. Optimal path: bar travels in a slight "J-curve" around the face then straight up. Pressing behind the neck increases shoulder injury risk 3x.',
      benefits: 'Essential for overhead functional strength. Strengthens the rotator cuff as stabilizers. Strong overhead press correlates with reduced shoulder injury rates.',
      commonMistakes: 'Excessive lumbar arch compensates for weak shoulders. Asymmetric press indicates a strength imbalance. Incomplete lockout leaves gains on the table.'
    },
    modifications: {
      easier: ['Seated press', 'Partial range press', 'Lighter weight/resistance band'],
      harder: ['Push press (leg drive)', 'Single-arm press', 'Handstand push-up progression']
    }
  },
  deadlift: {
    name: 'Deadlift',
    icon: '🏋️‍♂️',
    category: 'strength',
    difficulty: 'intermediate',
    muscles: { primary: ['Hamstrings', 'Glutes', 'Erector Spinae'], secondary: ['Quadriceps', 'Lats', 'Grip/Forearms', 'Core'] },
    equipment: 'dumbbells/barbell recommended',
    cameraAngles: ['side'],
    bestAngle: 'side',
    angleNotes: {
      side: 'Essential — shows hip hinge angle, back position, and bar path. Other angles unreliable for deadlift form.'
    },
    science: {
      summary: 'The deadlift is the most complete compound movement — engages more total muscle mass than any other exercise.',
      muscles: 'Posterior chain dominant: hamstrings and glutes extend the hip, erector spinae maintains neutral spine, lats keep the bar close. Grip strength is often the limiting factor.',
      biomechanics: 'Spinal load is highest at the bottom of the lift when the torso is most horizontal. Maintaining a neutral spine distributes force across the entire vertebral column. A rounded lumbar spine concentrates force on the anterior disc — herniation risk.',
      benefits: 'Posterior chain development, bone density (compressive spinal loading triggers osteoblast activity), real-world lifting pattern. 10-week deadlift programs reduce chronic lower back pain intensity by 72% (Journal of Strength & Conditioning, 2015).',
      commonMistakes: 'Rounded lower back is the #1 injury mechanism. Bar drifting away from body increases moment arm on the spine. Hyperextension at lockout is unnecessary and loads facet joints.'
    },
    modifications: {
      easier: ['Romanian deadlift (less knee bend)', 'Sumo deadlift (wider stance)', 'Kettlebell deadlift'],
      harder: ['Single-leg RDL', 'Deficit deadlift', 'Snatch-grip deadlift']
    }
  },

  // EXTENDED EXERCISES (tracked via angle monitoring, no state machine yet)
  wall_sit: {
    name: 'Wall Sit',
    icon: '🧱',
    category: 'strength',
    difficulty: 'beginner',
    muscles: { primary: ['Quadriceps'], secondary: ['Glutes', 'Calves', 'Core'] },
    equipment: 'wall',
    cameraAngles: ['side'],
    bestAngle: 'side',
    trackingMode: 'isometric', // Hold-based like plank
    science: {
      summary: 'Isometric quad exercise. Your quads are under constant tension with zero joint movement.',
      muscles: 'Primarily loads the vastus medialis (inner quad), which is critical for knee stability. VMO weakness is the #1 contributor to patellofemoral pain syndrome.',
      biomechanics: 'At 90° knee angle, quadriceps generate ~3x bodyweight force. Deeper angles increase quad load. Back flat against wall eliminates spinal loading — making it ideal for back pain patients.',
      benefits: 'Quad endurance, knee joint stability, blood pressure reduction (isometric exercises lower systolic BP by 6-8mmHg over 8 weeks). Safe for most knee rehab protocols.',
      commonMistakes: 'Knees forward of ankles. Thighs not reaching parallel. Holding breath (Valsalva) — breathe normally.'
    },
    modifications: {
      easier: ['Higher position (less bend)', 'Shorter holds'],
      harder: ['Single-leg wall sit', 'Wall sit with calf raise', 'Weighted wall sit']
    }
  },
  glute_bridge: {
    name: 'Glute Bridge',
    icon: '🍑',
    category: 'strength',
    difficulty: 'beginner',
    muscles: { primary: ['Glutes'], secondary: ['Hamstrings', 'Core', 'Hip Flexors (stretched)'] },
    equipment: 'none',
    cameraAngles: ['side'],
    bestAngle: 'side',
    trackingMode: 'rep',
    science: {
      summary: 'Isolates the glutes without spinal loading. Foundation exercise for hip extension strength.',
      muscles: 'Gluteus maximus is the primary mover. The hip thrust variation (shoulders elevated) increases glute activation to 80% MVC vs 50% for standard bridges (Contreras et al., 2011).',
      biomechanics: 'At full extension, the hip reaches 0° (neutral) or slight hyperextension. Knees at 90° optimizes glute/hamstring ratio. Wider feet = more glute, closer = more hamstring.',
      benefits: 'Activates dormant glutes (from sitting all day), reduces lower back pain, improves sprint speed and jump height. Essential prereq before heavy squats and deadlifts.',
      commonMistakes: 'Hyperextending lower back at top (ribs flaring). Not squeezing glutes at peak. Pushing through toes instead of heels.'
    },
    modifications: {
      easier: ['Short-range bridges', 'Feet closer to body'],
      harder: ['Single-leg bridge', 'Hip thrust (shoulders on bench)', 'Banded bridge', 'Marching bridge']
    }
  },
  mountain_climbers: {
    name: 'Mountain Climbers',
    icon: '⛰️',
    category: 'hiit',
    difficulty: 'intermediate',
    muscles: { primary: ['Core', 'Hip Flexors'], secondary: ['Shoulders', 'Chest', 'Quads', 'Calves'] },
    equipment: 'none',
    cameraAngles: ['side'],
    bestAngle: 'side',
    trackingMode: 'rep',
    science: {
      summary: 'Full-body cardio exercise that elevates heart rate while strengthening core and shoulders.',
      muscles: 'Rectus abdominis and hip flexors drive knee movement. Deltoids and pecs stabilize the upper body. Rapidly alternating legs creates a cardiovascular demand of 8-10 METs.',
      biomechanics: 'Maintain plank position throughout — hips should not rise. Each "climb" is a hip flexion from ~180° to ~90°. Speed increases cardiovascular benefit but can compromise form.',
      benefits: 'Burns ~8-12 cal/min. Improves hip flexor endurance (often neglected). Excellent HIIT station exercise. Develops coordination between upper and lower body.',
      commonMistakes: 'Hips bouncing up and down. Not bringing knees far enough forward. Sagging shoulders/collapsing chest.'
    },
    modifications: {
      easier: ['Slow mountain climbers', 'Step-in instead of jump', 'Incline (hands on bench)'],
      harder: ['Cross-body climbers', 'Spider-man climbers', 'Slider mountain climbers']
    }
  },
  burpees: {
    name: 'Burpees',
    icon: '🔥',
    category: 'hiit',
    difficulty: 'advanced',
    muscles: { primary: ['Full Body'], secondary: ['Chest', 'Quads', 'Core', 'Shoulders', 'Glutes'] },
    equipment: 'none',
    cameraAngles: ['side'],
    bestAngle: 'side',
    trackingMode: 'rep',
    science: {
      summary: 'The ultimate metabolic conditioning exercise. Combines squat, plank, push-up, and jump into one movement.',
      muscles: 'Every major muscle group fires sequentially: quads/glutes (squat down), core/chest/triceps (push-up), hip flexors (jump feet in), quads/glutes/calves (jump up).',
      biomechanics: 'Heart rate reaches 85-95% max within 30 seconds. Energy expenditure: ~1.4 kcal per burpee (equivalent to 10 cal/min at moderate pace). Forces rapid transitions between concentric and eccentric phases.',
      benefits: 'Maximum calorie burn per unit time. Improves VO2max as effectively as running (JSCR, 2014). Develops power endurance. No equipment needed.',
      commonMistakes: 'Skipping the push-up. Not fully extending at the jump. Worm-like push-up (hips leading). Landing with locked knees.'
    },
    modifications: {
      easier: ['No push-up burpee', 'Step-back burpee (no jump back)', 'Half burpee (no jump)'],
      harder: ['Burpee box jump', 'Burpee pull-up', 'Double push-up burpee']
    }
  },
  jumping_jacks: {
    name: 'Jumping Jacks',
    icon: '⭐',
    category: 'cardio',
    difficulty: 'beginner',
    muscles: { primary: ['Calves', 'Hip Abductors'], secondary: ['Shoulders', 'Core'] },
    equipment: 'none',
    cameraAngles: ['front'],
    bestAngle: 'front',
    trackingMode: 'rep',
    science: {
      summary: 'Classic cardio warm-up that elevates heart rate and warms up the entire body.',
      muscles: 'Hip abductors/adductors control the lateral leg movement. Deltoids and supraspinatus control arm elevation. Calves provide the propulsion for jumping.',
      biomechanics: 'Low-impact when feet don\'t fully leave the ground. ~5-7 METs depending on pace. Shoulder abduction to 180° improves overhead mobility.',
      benefits: 'Excellent warm-up (raises core temperature 0.5-1°C in 2 minutes). Improves coordination. Burns ~8 cal/min. Accessible for all fitness levels.',
      commonMistakes: 'Landing on flat feet (land on balls of feet). Arms not reaching full overhead. Incomplete leg spread.'
    },
    modifications: {
      easier: ['Step-out jacks (no jump)', 'Half jacks (arms to shoulder height)', 'Seated jacks'],
      harder: ['Star jumps', 'Squat jacks', 'Plank jacks']
    }
  },
  high_knees: {
    name: 'High Knees',
    icon: '🏃',
    category: 'hiit',
    difficulty: 'intermediate',
    muscles: { primary: ['Hip Flexors', 'Quads'], secondary: ['Calves', 'Core', 'Glutes'] },
    equipment: 'none',
    cameraAngles: ['front', 'side'],
    bestAngle: 'front',
    trackingMode: 'rep',
    science: {
      summary: 'Running in place with exaggerated knee lift. One of the highest calorie-burning bodyweight exercises.',
      muscles: 'Iliopsoas and rectus femoris drive the knee up. Gastrocnemius/soleus provide the push-off. Core stabilizes against rotational forces from alternating leg movement.',
      biomechanics: 'Target: knee to hip height (thigh parallel to ground). Each leg cycle: hip flexion to 90°, then rapid extension. Heart rate reaches 80-90% max within 20 seconds at max effort.',
      benefits: 'Improves running speed and knee drive. Burns 8-11 cal/min. Excellent HIIT station. Develops hip flexor strength often neglected in traditional strength training.',
      commonMistakes: 'Leaning back (reduces hip flexion). Knees not reaching hip height. Landing heavy/flat-footed.'
    },
    modifications: {
      easier: ['March in place (no jump)', 'Slower pace', 'Lower knee target'],
      harder: ['Sprint-pace high knees', 'Weighted high knees', 'High knees with arm drive']
    }
  },
  squat_jump: {
    name: 'Squat Jumps',
    icon: '🚀',
    category: 'hiit',
    difficulty: 'intermediate',
    muscles: { primary: ['Quadriceps', 'Glutes', 'Calves'], secondary: ['Hamstrings', 'Core'] },
    equipment: 'none',
    cameraAngles: ['side', 'front'],
    bestAngle: 'side',
    trackingMode: 'rep',
    science: {
      summary: 'Plyometric squat variation. Develops explosive power through the stretch-shortening cycle.',
      muscles: 'Same as squat but with added calf involvement for the jump. Fast-twitch muscle fibers (Type II) are preferentially recruited during the explosive concentric phase.',
      biomechanics: 'The stretch-shortening cycle stores elastic energy during the descent and releases it during the jump. Ground reaction forces reach 3-5x bodyweight on landing. Proper landing mechanics (toe-to-heel, soft knees) are critical.',
      benefits: 'Increases vertical jump height by 10-15% over 6 weeks. Develops power (force × velocity) which declines faster than strength with aging. Boosts EPOC (afterburn) more than steady-state cardio.',
      commonMistakes: 'Landing with straight knees (injury risk). Not reaching full squat depth before jumping. Knees caving on landing. Leaning forward excessively.'
    },
    modifications: {
      easier: ['Half-squat jump', 'Pause squat jump (reset between reps)', 'Box squat jump'],
      harder: ['Tuck jump', 'Box jump', 'Depth jump (step off box, jump)']
    }
  },
  superman: {
    name: 'Superman Hold',
    icon: '🦸',
    category: 'core',
    difficulty: 'beginner',
    muscles: { primary: ['Erector Spinae', 'Glutes'], secondary: ['Hamstrings', 'Rear Deltoid', 'Rhomboids'] },
    equipment: 'none',
    cameraAngles: ['side'],
    bestAngle: 'side',
    trackingMode: 'isometric',
    science: {
      summary: 'Prone back extension exercise. One of the safest ways to strengthen the posterior chain.',
      muscles: 'Erector spinae (iliocostalis, longissimus, spinalis) extend the spine. Glutes extend the hips. Posterior deltoids and rhomboids retract the scapulae.',
      biomechanics: 'Activates the posterior chain against gravity without spinal compression (unlike deadlift). EMG studies show 40-50% MVC of erector spinae during superman hold.',
      benefits: 'Counteracts the effects of sitting and anterior-dominant training. Reduces lower back pain in 65% of patients when done 3x/week (Spine, 2018). Improves posture.',
      commonMistakes: 'Hyperextending the neck (look at the floor, not ahead). Using momentum instead of controlled lift. Holding breath.'
    },
    modifications: {
      easier: ['Alternating arm/leg superman', 'Bird dog (all fours)', 'Cobra stretch (arms only)'],
      harder: ['Superman with pulse', 'Weighted superman', 'Superman plank (alternating)']
    }
  },
  calf_raises: {
    name: 'Calf Raises',
    icon: '🦶',
    category: 'strength',
    difficulty: 'beginner',
    muscles: { primary: ['Gastrocnemius', 'Soleus'], secondary: ['Tibialis Anterior (eccentric)'] },
    equipment: 'none (step optional)',
    cameraAngles: ['side'],
    bestAngle: 'side',
    trackingMode: 'rep',
    science: {
      summary: 'Isolated calf exercise. Essential for ankle stability, jumping, and running performance.',
      muscles: 'The gastrocnemius (two-headed, superficial) crosses both the knee and ankle — most active with straight knees. The soleus (deep) only crosses the ankle — most active with bent knees.',
      biomechanics: 'Full range of motion: from dorsiflexion (heel below toes on a step) to maximum plantarflexion. Calf muscles generate forces up to 8x bodyweight during running.',
      benefits: 'Improves ankle stability, reduces Achilles tendinitis risk, enhances jumping ability. Critical for older adults — calf strength correlates with fall prevention.',
      commonMistakes: 'Not reaching full plantarflexion (going on tippy-toes). Bouncing (using momentum). Leaning forward (shifts load off calves).'
    },
    modifications: {
      easier: ['Seated calf raises', 'Wall-supported raises', 'Bilateral (two legs)'],
      harder: ['Single-leg raises', 'Deficit raises (off a step)', 'Weighted raises', 'Explosive calf jumps']
    }
  },
  tricep_dip: {
    name: 'Tricep Dips',
    icon: '💺',
    category: 'strength',
    difficulty: 'intermediate',
    muscles: { primary: ['Triceps'], secondary: ['Anterior Deltoid', 'Chest (lower)'] },
    equipment: 'chair/bench',
    cameraAngles: ['side'],
    bestAngle: 'side',
    trackingMode: 'rep',
    science: {
      summary: 'Bodyweight tricep isolation using a chair or bench. One of the most effective tricep exercises.',
      muscles: 'All three tricep heads (lateral, medial, long) are heavily activated. The long head is most active when the shoulder is extended (leaning forward). Chair dips emphasize the lateral and medial heads.',
      biomechanics: 'Optimal depth: elbows to 90°. Deeper increases shoulder joint stress without additional tricep benefit. Feet closer to body = easier, feet farther = harder.',
      benefits: 'Builds pushing strength complementary to push-ups. Triceps are 2/3 of arm size — more efficient for arm aesthetics than bicep curls. Functional for getting up from chairs.',
      commonMistakes: 'Shoulders shrugging up to ears. Elbows flaring outward (should track backward). Going too deep (shoulder strain).'
    },
    modifications: {
      easier: ['Bent-knee dips', 'Partial range', 'Feet flat on floor closer to body'],
      harder: ['Straight-leg dips', 'Weighted dips', 'Ring dips']
    }
  },
  side_plank: {
    name: 'Side Plank',
    icon: '📐',
    category: 'core',
    difficulty: 'intermediate',
    muscles: { primary: ['Obliques', 'Quadratus Lumborum'], secondary: ['Glutes (medius)', 'Shoulders', 'Transverse Abdominis'] },
    equipment: 'none',
    cameraAngles: ['front'],
    bestAngle: 'front',
    trackingMode: 'isometric',
    science: {
      summary: 'Lateral core stability exercise. Activates the obliques 2x more than front plank.',
      muscles: 'Internal and external obliques control lateral flexion. Quadratus lumborum (deep lateral back muscle) is the primary spinal lateral stabilizer. Gluteus medius stabilizes the hip.',
      biomechanics: 'The body must resist gravity pulling the hips toward the floor. A straight line from head to feet indicates proper alignment. Hip drop is the most common form breakdown.',
      benefits: 'Addresses lateral core weakness — a common blind spot. Reduces lower back pain, especially when pain is one-sided. Improves scoliosis symptoms. Essential for rotational sports.',
      commonMistakes: 'Hips dropping or rotating. Not stacking shoulders. Looking down instead of forward. Holding breath.'
    },
    modifications: {
      easier: ['Knee side plank', 'Short holds (10-15s)', 'Wall-assisted'],
      harder: ['Side plank with hip dip', 'Side plank with leg lift', 'Copenhagen plank (top leg elevated)']
    }
  },
  bicycle_crunch: {
    name: 'Bicycle Crunches',
    icon: '🚲',
    category: 'core',
    difficulty: 'intermediate',
    muscles: { primary: ['Rectus Abdominis', 'Obliques'], secondary: ['Hip Flexors'] },
    equipment: 'none',
    cameraAngles: ['side', 'front'],
    bestAngle: 'front',
    trackingMode: 'rep',
    science: {
      summary: 'Dynamic rotational ab exercise. ACE study ranked it the #1 exercise for rectus abdominis activation.',
      muscles: 'The rotation component engages obliques (both internal and external) while the crunch activates rectus abdominis. Alternating leg movement adds hip flexor endurance.',
      biomechanics: 'EMG studies show 148% more rectus abdominis activation and 190% more oblique activation compared to standard crunches (American Council on Exercise, 2001).',
      benefits: 'Maximum ab activation per rep. Develops rotational core strength needed for sports and daily activities. No equipment needed.',
      commonMistakes: 'Pulling on neck with hands. Not fully rotating (elbow to opposite knee). Rushing through reps (losing mind-muscle connection). Feet touching floor between reps.'
    },
    modifications: {
      easier: ['Slow bicycle (no crunch, just legs)', 'Dead bug (similar pattern, back on floor)', 'Standard crunch first'],
      harder: ['Weighted bicycle', 'V-sit bicycle', 'Hanging bicycle']
    }
  }
};

// ANGLE DETECTION PROFILES

/**
 * Multi-angle camera support
 * Each exercise can be performed from different camera angles.
 * This adjusts which landmarks are prioritized and how form is assessed.
 */
const ANGLE_PROFILES = {
  side: {
    label: 'Side View',
    description: 'Camera to your left or right. Best for most exercises.',
    icon: '👈',
    primaryLandmarks: 'shoulder-hip-knee-ankle chain on the visible side',
    depthAccuracy: 'high',
    widthAccuracy: 'low'
  },
  front: {
    label: 'Front View',
    description: 'Camera facing you directly. Best for symmetry checks.',
    icon: '🎯',
    primaryLandmarks: 'bilateral comparison — left vs right',
    depthAccuracy: 'low',
    widthAccuracy: 'high'
  },
  '45deg': {
    label: '45° Angle',
    description: 'Camera at a diagonal. Good all-around view.',
    icon: '↗️',
    primaryLandmarks: 'compromise between depth and width visibility',
    depthAccuracy: 'medium',
    widthAccuracy: 'medium'
  }
};

// RECOMMENDATION ENGINE

/**
 * Smart exercise recommendations based on workout history
 */
class RecommendationEngine {
  /**
   * Generate personalized recommendations
   * @param {Array} workoutHistory - Past workouts from DB
   * @param {Object} personalBests - From VoiceCoach
   * @param {Object} bodyRadar - From AnalyticsEngine
   * @returns {Object} Recommendations
   */
  static generate(workoutHistory, personalBests, bodyRadar) {
    const recs = {
      todaysWorkout: null,
      weakAreas: [],
      nextExercise: null,
      programSuggestion: null,
      tips: []
    };

    if (!workoutHistory || workoutHistory.length === 0) {
      recs.todaysWorkout = {
        exercises: ['squat', 'pushup', 'plank'],
        reason: 'Start with the fundamentals. These 3 exercises cover your whole body.'
      };
      recs.tips.push('New here? Start with squats, push-ups, and plank. Master form before adding volume.');
      return recs;
    }

    // Find weak areas from body radar
    if (bodyRadar) {
      const sorted = Object.entries(bodyRadar).sort((a, b) => a[1] - b[1]);
      recs.weakAreas = sorted.slice(0, 2).map(([area, score]) => ({
        area,
        score,
        exercises: RecommendationEngine._exercisesForArea(area)
      }));
    }

    // Suggest today's workout based on what they haven't done recently
    const last3Days = workoutHistory.filter(w => {
      const d = new Date(w.date);
      const now = new Date();
      return (now - d) < 3 * 86400000;
    });
    const recentTypes = new Set(last3Days.map(w => w.exerciseType));

    const allTypes = ['squat', 'pushup', 'plank', 'lunge', 'shoulderpress', 'deadlift'];
    const neglected = allTypes.filter(t => !recentTypes.has(t));

    if (neglected.length >= 3) {
      recs.todaysWorkout = {
        exercises: neglected.slice(0, 3),
        reason: `You haven't done these in 3+ days. Time to hit them!`
      };
    } else {
      // Suggest based on weak areas
      const weakExercises = recs.weakAreas.length > 0
        ? recs.weakAreas.flatMap(w => w.exercises).slice(0, 3)
        : ['squat', 'pushup', 'plank'];
      recs.todaysWorkout = {
        exercises: [...new Set(weakExercises)].slice(0, 3),
        reason: 'Targeting your weakest areas today.'
      };
    }

    // Form improvement tips
    const recentWorkouts = workoutHistory.slice(0, 10);
    const avgForm = recentWorkouts.reduce((s, w) => s + (w.formScore || 0), 0) / recentWorkouts.length;
    if (avgForm < 70) {
      recs.tips.push('Your form scores are averaging below 70%. Focus on slower, controlled reps. Quality > quantity.');
    }
    if (avgForm > 90) {
      recs.tips.push('Your form is excellent! Consider increasing reps or trying harder variations.');
    }

    // Volume recommendations
    const last7 = workoutHistory.filter(w => {
      const d = new Date(w.date);
      const now = new Date();
      return (now - d) < 7 * 86400000;
    });
    if (last7.length < 3) {
      recs.tips.push('Aim for at least 3 sessions per week. Consistency beats intensity.');
    }
    if (last7.length >= 6) {
      recs.tips.push('You\'re training a lot! Make sure to include rest days for recovery.');
    }

    return recs;
  }

  static _exercisesForArea(area) {
    const map = {
      Legs: ['squat', 'lunge', 'wall_sit', 'calf_raises', 'squat_jump'],
      Chest: ['pushup'],
      Core: ['plank', 'side_plank', 'bicycle_crunch', 'mountain_climbers', 'superman'],
      Shoulders: ['shoulderpress'],
      Back: ['deadlift', 'superman'],
      Arms: ['pushup', 'tricep_dip', 'shoulderpress']
    };
    return map[area] || [];
  }
}

// EXERCISE NAME RESOLVER

function getExerciseName(type) {
  const entry = EXERCISE_CATALOG[type];
  return entry ? entry.name : type;
}

function getExerciseScience(type) {
  const entry = EXERCISE_CATALOG[type];
  return entry ? entry.science : null;
}

function getExerciseModifications(type) {
  const entry = EXERCISE_CATALOG[type];
  return entry ? entry.modifications : null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EXERCISE_CATALOG, ANGLE_PROFILES, RecommendationEngine,
    getExerciseName, getExerciseScience, getExerciseModifications
  };
}
