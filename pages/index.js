import { useState, useEffect, Fragment } from "react";
import Head from "next/head";
import FileSaver from "file-saver";
import {
  ArrowPathIcon,
  ArrowUpRightIcon,
  QuestionMarkCircleIcon,
  LightBulbIcon,
  HomeIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import useSound from "use-sound";
import { Combobox, Dialog, Transition } from "@headlessui/react";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const examples = [
  {
    prompt:
      "Muddy ground with autumn leaves seamless texture, trending on artstation, base color, albedo, 4k",
    image:
      "https://replicate.delivery/mgxm/9b8f4ec9-eef0-437f-a27a-cbd233d22407/out-0.png",
  },
  {
    prompt:
      "Lunar surface seamless texture, trending on artstation, base color, albedo, 4k",
    image:
      "https://replicate.delivery/mgxm/8f75db20-72d9-4917-bc86-db4ca5d73c35/out-0.png",
  },
  {
    prompt:
      "Tree bark seamless photoscan texture, trending on artstation, base color, albedo, 4k",
    image:
      "https://replicate.delivery/mgxm/7d3bc46c-612f-42cb-9347-317b2db1d3d6/out-0.png",
  },
  {
    prompt: "Flamingo painting",
    image:
      "https://replicate.delivery/pbxt/K2M3OVwEpSLxNdZDmEe8K5fIGN25TOUTQA7JnGb5n4fcsY2gA/out-0.jpg",
  },
  {
    prompt:
      "Ancient carvings trim sheet texture, trending on artstation, sandstone, base color, albedo, 4k",
    image:
      "https://replicate.delivery/mgxm/147f2329-db56-4a6a-a950-7a358f731fb7/out-0.png",
  },
  {
    prompt:
      "Wall made from chocolate bars seamless texture, trending on artstation, tasty, base color, albedo, 4k",
    image:
      "https://replicate.delivery/mgxm/9c645c58-82e8-4d88-bb7d-972472978698/out-0.png",
  },
  {
    prompt: "A painting with oranges and lemons, Picasso",
    image:
      "https://replicate.delivery/pbxt/N08AVoJ7ji7kBp2CeNLtl96C7kmYMwA4EbAd1BpPodzEPAOIA/out-0.jpg",
  },
  {
    prompt: "Monet, lilacs, bright, oil painting",
    image:
      "https://replicate.delivery/pbxt/1b4tM1hOSi7lGl9ks94Tdr9vFj8ON7uDe1eXRzQ51LUIiAcQA/out-0.jpg",
  },
];

const IMAGE_SIZE = 180;

export default function Home() {
  const [prompt, setPrompt] = useState(null);
  const [cols, setCols] = useState(null);
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(null);
  const [wallpaper, setWallpaper] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false); // creator modal
  const [aboutOpen, setAboutOpen] = useState(false); // about modal
  const [saveOpen, setSaveOpen] = useState(false); // save modal
  const [status, setStatus] = useState(null);
  const [placeholder, setPlaceholder] = useState(
    examples[Math.floor(Math.random() * examples.length)].prompt
  );
  const [blur, setBlur] = useState(false);

  //   sounds
  const [play] = useSound("/complete.wav", { volume: 0.25 });

  useEffect(() => {
    // On page load, set the grid cols/rows based on the window size
    var cols = Math.min(Math.ceil(window.innerWidth / IMAGE_SIZE), 12);
    var rows = Math.min(Math.ceil(window.innerHeight / IMAGE_SIZE), 12) + 1;
    const example = examples[Math.floor(Math.random() * examples.length)];
    setWallpaper(example.image);
    setPlaceholder(example.prompt);
    setPrompt(example.prompt);
    resize(cols, rows);
  }, []);

  const resize = (cols, rows) => {
    setTotal(cols * rows);
    setCols(cols);
    setRows(rows);
  };

  const parseLogs = (logs) => {
    if (!logs) {
      return 0;
    } else {
      const lastLine = logs.split("\n").slice(-1)[0];
      const pct = lastLine.split("it")[0];
      return pct * 2;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const response = await fetch("/api/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: e.target.prompt.value,
        width: "512",
        height: "512",
      }),
    });
    let prediction = await response.json();
    if (response.status !== 201) {
      setError(prediction.detail);
      return;
    }
    setLoading(true);

    while (
      prediction.status !== "succeeded" &&
      prediction.status !== "failed"
    ) {
      await sleep(1000);
      const response = await fetch("/api/predictions/" + prediction.id);
      prediction = await response.json();
      if (response.status !== 200) {
        setError(prediction.detail);
        return;
      }
      console.log(prediction.logs);
      setStatus(parseLogs(prediction.logs));

      if (prediction.status === "succeeded") {
        resetWallpaper(prediction.output);
        setLoading(false);
        play();
      }
    }
  };

  const resetWallpaper = (image) => {
    setOpen(false);
    setStatus(null);

    // in order to redo the dropdown effect, we need to remove the animation class
    // and then add it back
    const tiles = document.getElementsByClassName("tile");
    for (let i = 0; i < tiles.length; i++) {
      tiles[i].classList.remove("animate-fadein");
    }

    setTimeout(() => {
      for (let i = 0; i < tiles.length; i++) {
        tiles[i].classList.add("animate-fadein");
      }
      setWallpaper(image);
    }, 10);
  };

  const stitchImages = async (imageUrl, screenWidth, screenHeight) => {
    /**
     * Given a url for an image (which comes from replicate),
     * stitch it into a canvas and return the canvas so we can download it.
     *
     * Surprisingly complicated I know, but seems like it's necessary to download a grid of images.
     */
    const image = await fetch(imageUrl);
    const imageBlob = await image.blob();
    const imageURL = URL.createObjectURL(imageBlob);

    var myCanvas = document.getElementById("canvas");
    var ctx = myCanvas.getContext("2d");

    ctx.canvas.width = screenWidth;
    ctx.canvas.height = screenHeight;

    var img = new Image();
    img.src = imageURL;

    var x = 0;
    var y = 0;

    img.addEventListener("load", (e) => {
      while (y < screenHeight) {
        while (x < screenWidth) {
          ctx.drawImage(img, x, y);
          x += 512;
        }
        x = 0;
        y += 512;
      }
    });

    return myCanvas.toDataURL("image/png");
  };

  const download = async (image, width, height) => {
    stitchImages(image, width, height);

    // I couldn't figure out the async/await version of this
    // so I just used a setTimeout to wait for the canvas to be drawn
    setTimeout(() => {
      var myCanvas = document.getElementById("canvas");
      const dataUrl = myCanvas.toDataURL("image/png");
      FileSaver.saveAs(dataUrl, "wallpaper.png");
    }, 100);
  };

  const handleInspire = () => {
    const newWallpaper = examples[Math.floor(Math.random() * examples.length)];
    typeWriter("", newWallpaper.prompt);
  };

  const typeWriter = (currentPrompt, newPrompt) => {
    var i = 0;

    var interval = setInterval(() => {
      if (i < newPrompt.length) {
        setPrompt((currentPrompt += newPrompt.charAt(i)));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 10);
  };

  return (
    <>
      <div className="relative min-h-screen bg-black">
        <Head>
          <title>Wallpaper Creator</title>
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0"
          ></meta>
        </Head>

        {/* About */}
        <div className="absolute z-10 top-4 left-4">
          <button
            onClick={() => setAboutOpen(true)}
            class="hover:border-white border-transparent border-2 rounded-md p-2"
          >
            <span class="text-3xl">🏠</span>
          </button>
        </div>

        {/* App Icons */}
        <div className="hidden absolute z-10 top-16 sm:left-16 left-6">
          <div className="grid grid-cols-2 sm:grid-cols-1 gap-8">
            <button
              className="bg-transparent bg-none border-none p-2 group"
              onClick={() => setSaveOpen(true)}
            >
              <span className="text-6xl sm:text-8xl">💾</span>

              <p className="font-bold text-lg text-white bg-opacity-75 bg-gray-900 mt-2 group-hover:text-gray-900 group-hover:bg-white px-2">
                Save
              </p>
            </button>
            <button
              className="bg-transparent bg-none border-none p-2 group"
              onClick={() => setAboutOpen(true)}
            >
              <span className="text-6xl sm:text-8xl">❔</span>

              <p className="font-bold text-lg text-white bg-opacity-75 bg-gray-900 mt-2 group-hover:text-gray-900 group-hover:bg-white px-2">
                About
              </p>
            </button>
          </div>
        </div>

        {/* Repeating tiles */}
        <div
          className={blur && "transition ease-linear delay-50 blur-sm"}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
        >
          {Array(total)
            .fill(1)
            .map((_value, index) => (
              <button key={`tile-${index}`} onClick={() => setSaveOpen(true)}>
                <img
                  id={index}
                  className={`tile animate-fadein ${
                    !blur &&
                    "hover:rounded-sm hover:shadow-gray-900 hover:shadow-xl transition ease-linear delay-100 hover:scale-125"
                  }`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                  src={wallpaper}
                  alt=""
                />
              </button>
            ))}
        </div>

        {/* Canvas */}
        <div className="fixed hidden top-0 left-0">
          <canvas id="canvas" className="fixed top-0 left-0"></canvas>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          class="absolute top-1/4 right-0 py-12 pl-16 mr-6"
        >
          <fieldset>
            <div className="mt-4">
              <textarea
                required={true}
                onFocus={() => setBlur(true)}
                onBlur={() => setBlur(false)}
                name="prompt"
                id="prompt"
                rows="3"
                cols="40"
                autoCorrect="false"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={placeholder}
                style={{ resize: "none" }}
                className="w-full text-sm rounded-lg bg-gray-900 bg-opacity-75 text-gray-200 ring-0 focus:outline-none focus:ring-1 focus:ring-offset-2"
              />
            </div>

            <div className="mt-2">
              {loading ? (
                <div className="px-2">
                  {status ? (
                    <div>
                      <div class="w-full bg-gray-900 rounded-full h-2">
                        <div
                          class="bg-gray-100 h-2 rounded-full"
                          style={{ width: `${status}%` }}
                        ></div>
                      </div>
                      <div className="text-gray-100">{status}%</div>
                    </div>
                  ) : (
                    <span className="animate-pulse text-white">
                      <div role="status" className="inline-flex">
                        <svg
                          aria-hidden="true"
                          class="inline w-4 h-4 mr-2 text-gray-200 animate-spin fill-blue-600"
                          viewBox="0 0 100 101"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                            fill="currentColor"
                          />
                          <path
                            d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                            fill="currentFill"
                          />
                        </svg>
                        <span class="sr-only">Loading...</span>
                      </div>
                      Starting up...
                    </span>
                  )}
                </div>
              ) : (
                <div class="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleInspire()}
                    className="mr-2 inline-flex items-center hover:border-white border-transparent rounded-md border-2 text-white px-3 py-2 text-sm font-medium leading-4 shadow-sm focus:outline-none focus:ring-1 focus:ring-offset-2 focus:border-white"
                  >
                    <LightBulbIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-md  bg-opacity-75 border-transparent border-2 hover:border-white bg-gray-900 px-3 py-2 text-sm font-medium leading-4 text-white shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-offset-2"
                  >
                    <PlusIcon
                      className="-ml-0.5 mr-2 h-4 w-4"
                      aria-hidden="true"
                    />
                    New Wallpaper
                  </button>
                </div>
              )}
            </div>
          </fieldset>
        </form>

        <About open={aboutOpen} setOpen={setAboutOpen} />
        <Save
          open={saveOpen}
          setOpen={setSaveOpen}
          wallpaper={wallpaper}
          download={download}
        />
      </div>
    </>
  );
}

export function About({ open, setOpen }) {
  return (
    <Transition.Root show={open} as={Fragment} appear>
      <Dialog
        autoFocus={false}
        as="div"
        className="relative z-10"
        onClose={setOpen}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-50 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto p-4 sm:p-6 md:p-20 mt-32">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm mx-auto sm:p-6">
              <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                <button
                  type="button"
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
                  onClick={() => setOpen(false)}
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              <div>
                <div className="text-center">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    About
                  </Dialog.Title>
                </div>
              </div>
              <div className="window-body mt-4">
                <fieldset class="space-y-3">
                  <p>
                    Tiler is an{" "}
                    <a
                      className="font-semibold hover:text-blue-800"
                      href="https://github.com/replicate/wallpaper"
                    >
                      open-source project
                    </a>{" "}
                    that provides an interface for creating tileable images.
                  </p>

                  <p>
                    It works by using{" "}
                    <a
                      className="font-semibold hover:text-blue-800"
                      href="https://replicate.com/tommoore515/material_stable_diffusion"
                    >
                      material stable diffusion,
                    </a>{" "}
                    which was created by{" "}
                    <a
                      className="font-semibold hover:text-blue-800"
                      href="https://twitter.com/tommoore515"
                    >
                      Tom Moore.
                    </a>{" "}
                    The model is hosted on{" "}
                    <a
                      className="font-semibold hover:text-blue-800"
                      href="https://replicate.com"
                    >
                      Replicate
                    </a>
                    , which exposes a cloud API for running predictions.
                  </p>

                  <p>
                    This website is built with Next.js and hosted on Vercel, and
                    uses Replicate&apos;s API to run the material stable
                    diffusion model. The source code is publicly available on
                    GitHub. Pull requests welcome!
                  </p>

                  <div className="pt-8 space-x-3 flex justify-between">
                    <a
                      className="text-blue-600"
                      href="https://github.com/replicate/wallpaper"
                    >
                      <button className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                        See Code
                      </button>
                    </a>

                    <a href="https://replicate.com">
                      <button className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                        Build on Replicate
                      </button>
                    </a>
                  </div>
                </fieldset>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

export function Save({ open, setOpen, wallpaper, download }) {
  return (
    <Transition.Root show={open} as={Fragment} appear>
      <Dialog
        autoFocus={false}
        as="div"
        className="relative z-10"
        onClose={setOpen}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-50 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto p-4 sm:p-6 md:p-20 mt-32">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm mx-auto sm:p-6">
              <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                <button
                  type="button"
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
                  onClick={() => setOpen(false)}
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              <div>
                <div className="text-center">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Download Tiles
                  </Dialog.Title>
                  <p class="mt-2 text-gray-500">
                    Download your tiles as a wallpaper.
                  </p>
                </div>
              </div>

              <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-y-12 sm:gap-0 text-center">
                <div>
                  <span className="text-6xl">🖥️</span>
                  <p className="mt-4 text-gray-500">Desktop</p>
                  <div className="mt-2">
                    <button
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      onClick={() => download(wallpaper, 3800, 2100)}
                    >
                      Download
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-6xl">📱</span>
                  <p className="mt-4 text-gray-500">Phone</p>
                  <div className="mt-2">
                    <button
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      onClick={() => download(wallpaper, 1170, 2532)}
                    >
                      Download
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-6xl">🖼️</span>
                  <p className="mt-4 text-gray-500">Single Tile</p>
                  <div className="mt-2">
                    <button
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      onClick={() => download(wallpaper, 256, 256)}
                    >
                      Download
                    </button>
                  </div>
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
