# to run: 
# $ cd .../speech_feature_online
# $ python -m uvicorn prototype:app --reload
# (--reload ensures relaunch at every saved change in this file)

import aiofiles, io, os, csv, random
from typing import List
from zipfile import ZipFile
from fastapi import FastAPI, File, UploadFile, Request, Form
from fastapi.templating import Jinja2Templates
from fastapi.responses import FileResponse, HTMLResponse
from shennong.audio import Audio
from shennong.processor.spectrogram import SpectrogramProcessor
from shennong.processor.filterbank import FilterbankProcessor
from shennong.processor.mfcc import MfccProcessor
from shennong.processor.plp import PlpProcessor
from shennong.processor import (KaldiPitchProcessor, KaldiPitchPostProcessor)
from shennong.processor import (CrepePitchProcessor, CrepePitchPostProcessor)
from shennong.processor.energy import EnergyProcessor
from shennong.postprocessor.cmvn import CmvnPostProcessor
from shennong.postprocessor.delta import DeltaPostProcessor
from shennong.postprocessor.vad import VadPostProcessor
from shennong import Features, FeaturesCollection
from datetime import date
import shutil

templates =  Jinja2Templates(directory="templates")

# executive decision made: collecting Features per utterance, not utterance Features 
# per Feature (ie. {X.spectro, X.filter, X.mfcc}, NOT {X.spectro, Y.spectro, Z.spectro})
# (the latter would need different implementation; could be done in future)

# defining our shennong "analyser" function here before we even create the app:

async def analyser(file: str, subdir: str, fts: list, settings: dict):
    """
    uses shennong to extract features from <file>. features are listed in <fts>,
    while <settings> contains specifications with which to calculate <fts>. 
    saves user-specified file formatto disk and returns filename of saved file. 
    at the end cleans up audio file from disk.
    
    file (str): filename of file saved to disk
    subdir (str): subdirectory of tmp where file is located
    fts (list): list of feature names to be analysed (of those available)
    settings (dict): dictionary of available user-adjusted settings, either set to
        user value or to default value
        {"channel":int, "fr_len":int, "fr_sh":int, "window":str, 
           "snip":bool, "min_k":int, "max_k":int, "res":str}
    """
    if file.endswith(".flac"):
        name=file[:-5]
    else:
        name=file[:-4]
    
    # we will collect calculated Features in here:
    colln = FeaturesCollection()
    # and optional CMVN collection here:
    cmvn_hopefuls = {}
    
    # read audiofile into Shennong:
    sound = Audio.load("tmp/{}/{}".format(subdir,file))
    if sound.nchannels > 1: # converting to mono; user-set or default channel chosen:
        sound = sound.channel(int(settings["channel"])-1)
    samrate = sound.sample_rate
    
    if "spectro" in fts:
        processor = SpectrogramProcessor(sample_rate=samrate,frame_shift=settings["fr_sh"],frame_length=settings["fr_len"],window_type=settings["window"],snip_edges=settings["snip"])
        spectro = processor.process(sound)
        colln["spectrogram"] = spectro
        if "spectro_cmvn" in fts:
            cmvn_hopefuls["spectrogram"] = spectro
        if "spectro_delta" in fts:
            postproc = DeltaPostProcessor()
            colln["spectrogram_delta"] = postproc.process(spectro)
    if "filt" in fts:
        processor = FilterbankProcessor(sample_rate=samrate,frame_shift=settings["fr_sh"],frame_length=settings["fr_len"],window_type=settings["window"],snip_edges=settings["snip"])
        filterbank = processor.process(sound)
        colln["filterbank"] = filterbank
        if "filt_cmvn" in fts:
            cmvn_hopefuls["filterbank"] = filterbank
        if "filt_delta" in fts:
            postproc = DeltaPostProcessor()
            colln["filterbank_delta"] = postproc.process(filterbank)
    if "mfcc" in fts:
        processor = MfccProcessor(sample_rate=samrate,frame_shift=settings["fr_sh"],frame_length=settings["fr_len"],window_type=settings["window"],snip_edges=settings["snip"])
        mfcc = processor.process(sound)
        colln["mfcc"] = mfcc
        if "mfcc_cmvn" in fts:
            cmvn_hopefuls["mfcc"] = mfcc
        if "mfcc_delta" in fts:
            postproc = DeltaPostProcessor()
            colln["mfcc_delta"] = postproc.process(mfcc)
        if "mfcc_vad" in fts:
            postproc = VadPostProcessor()
            colln["mfcc_vad"] = postproc.process(mfcc)
    if "plp" in fts:
        processor = PlpProcessor(sample_rate=samrate,frame_shift=settings["fr_sh"],frame_length=settings["fr_len"],window_type=settings["window"],snip_edges=settings["snip"])
        plp = processor.process(sound)
        colln["plp"] = plp
        if "plp_cmvn" in fts:
            cmvn_hopefuls["plp"] = plp
        if "plp_delta" in fts:
            postproc = DeltaPostProcessor()
            colln["plp_delta"] = postproc.process(plp)
        if "plp_vad" in fts:
            postproc = VadPostProcessor()
            colln["plp_vad"] = postproc.process(plp)     
    if "p_kaldi" in fts:
        processor = KaldiPitchProcessor(sample_rate=samrate, frame_shift=settings["fr_sh"],frame_length=settings["fr_len"], min_f0=settings["min_k"], max_f0=settings["max_k"])
        intermed = processor.process(sound)
        postprocessor = KaldiPitchPostProcessor()
        p_kaldi = postprocessor.process(intermed) 
        colln["pitch_kaldi"] = p_kaldi
        if "p_kaldi_delta" in fts:
            postproc = DeltaPostProcessor()
            colln["pitch_kaldi_delta"] = postproc.process(p_kaldi)
    if "p_crepe" in fts:
        processor = CrepePitchProcessor(frame_shift=settings["fr_sh"], frame_length=settings["fr_len"])
        intermed = processor.process(sound)
        postprocessor = CrepePitchPostProcessor()
        p_crepe = postprocessor.process(intermed)
        colln["pitch_crepe"] = p_crepe     
        if "p_crepe_delta" in fts:
            postproc = DeltaPostProcessor()
            colln["pitch_crepe_delta"] = postproc.process(p_crepe)        
    if "energy" in fts:
        processor = EnergyProcessor(sample_rate=samrate,frame_shift=settings["fr_sh"],frame_length=settings["fr_len"],window_type=settings["window"],snip_edges=settings["snip"])
        energy = processor.process(sound)
        colln["energy"] = energy
        if "energy_cmvn" in fts:
            cmvn_hopefuls["energy"]        
        if "energy_delta" in fts:
            postproc = DeltaPostProcessor()
            colln["energy_delta"] = postproc.process(energy)           
    
    # now for CMVN:
    if len(cmvn_hopefuls)>0:
        # post-processor launched based on ndims of first item in Features list
        # but ndims is determined by the shared parameters of fr_sh and fr_len
        # (shared by all except pitch features - which are not included in CMVN 
        # for this reason)
        postprocessor = CmvnPostProcessor(cmvn_hopefuls[0].ndims)
        for hopeful in list(cmvn_hopefuls.keys()):
            postprocessor.accumulate(cmvn_hopefuls[hopeful])
        for hopeful in list(cmvn_hopefuls.keys()):
            colln["{}_cmvn".format(hopeful)] = postprocessor.process(cmvn_hopefuls[hopeful])
    
    
    if len(colln) > 0:
        colln.save("tmp/{}/results/{}_features.{}".format(subdir,name,settings["res"]))
    
    # clean up stored audio file:
    os.remove("tmp/{}/{}".format(subdir,file))
    
    return ("tmp/{}/results/{}_features.{}".format(subdir,name,settings["res"]))


app = FastAPI()

# we're alive!
@app.get("/", response_class=HTMLResponse)
async def root():
    html_content = """
    <html>
    <head>
        <title>Hello, World!</title>
    </head>
    <body>
        <h1>Hello, World!</h1>
    </body> 
    </html>"""    
    return HTMLResponse(content=html_content)

# load up our front page
@app.get("/home", response_class=HTMLResponse)
def form_post(request: Request):
    return templates.TemplateResponse("frontpage.html", context={"request": request})

# accept some form responses from users (files + settings)
@app.post("/home")
async def form_post(request: Request, files: List[UploadFile]=File(...),
                    channel:int=Form(...), fr_len:float=Form(...), fr_sh:float=Form(...),
                    window:str=Form(...), snip:bool=Form(...),
                    spectro:bool=Form(...), spectro_cmvn:bool=Form(...), spectro_delta:bool=Form(...),
                    filt:bool=Form(...), filt_cmvn:bool=Form(...), filt_delta:bool=Form(...), 
                    mfcc:bool=Form(...), mfcc_cmvn:bool=Form(...), mfcc_delta:bool=Form(...), mfcc_vad:bool=Form(...),
                    plp:bool=Form(...), plp_cmvn:bool=Form(...), plp_delta:bool=Form(...), plp_vad:bool=Form(...),
                    p_kaldi:bool=Form(...), p_kaldi_delta:bool=Form(...), min_k:int=Form(...), max_k:int=Form(...),
                    p_crepe:bool=Form(...), p_crepe_delta:bool=Form(...),
                    energy:bool=Form(...), energy_cmvn:bool=Form(...), energy_delta:bool=Form(...),
                    res:str=Form(...)):
    """
    files: our audio
    the rest of the features: unbearable list of shennong-specific settings
    > Y/N for Spectrogram, Filterbank, MFCC, PLP, pitch (kaldi, crêpe), energy
    > for each of the above, Y/N for available post-processing (out of CMVN, Delta, VAD)
    > for some of the above, additional settings
    > for all of the above, general settings
         > fr[ame]_sh[ift], fr[ame]_len[gth]
         > channel [to choose if stereo]
         > window type
         > snip[_edges]: discard (1) or keep (0) incomplete frames
         > res[ult] file format
    """
    # basic-as idiot-proofing: checks correct audio format before anything else
    for file in files:
        if not (file.filename.endswith(".mp3") or file.filename.endswith(".wav") 
                or file.filename.endswith(".ogg") or file.filename.endswith(".flac")):
            html_content = """
            <html>
            <head>
                <title>Incorrect file format</title>
            </head>
            <body>
                <h1>Incorrect file format</h1>
                The file you submitted was not an audio file we can work with.<br>
                Please try again with one of: wav, mp3, ogg, flac
            </body> 
            </html>"""
            return HTMLResponse(content=html_content)
        
    # our glorious assortiment of features:
    yn_fts = {"spectro":spectro, "spectro_cmvn":spectro_cmvn, "spectro_delta":spectro_delta, 
              "filt":filt, "filt_cmvn":filt_cmvn, "filt_delta":filt_delta,
              "mfcc":mfcc, "mfcc_cmvn":mfcc_cmvn, "mfcc_delta":mfcc_delta, "mfcc_vad":mfcc_vad, 
              "plp":plp, "plp_cmvn":plp_cmvn, "plp_delta":plp_delta, "plp_vad":plp_vad,
              "p_kaldi":p_kaldi, "p_kaldi_delta":p_kaldi_delta, 
              "p_crepe":p_crepe, "p_crepe_delta":p_crepe_delta, 
              "energy":energy, "energy_cmvn":energy_cmvn, "energy_delta":energy_delta}
    y_fts = []
    for ft in list(yn_fts.keys()):
        if yn_fts[ft]:
            y_fts.append(ft)
    
    # our magnificent array of settings:
    settings = {"channel":int(channel), "fr_len":fr_len, "fr_sh":fr_sh, 
                "window":str(window), "snip":snip, "min_k":int(min_k), 
                "max_k":int(max_k), "res":res}
        
    # make a "custom" subdirectory of temp (safeguard against 2 people having a "john.mp3")
    subdir = str(random.randrange(100000))
    
    # read files and save to disk:
    for file in files:
        async with aiofiles.open("tmp/{}/{}".format(subdir, file.filename), 'wb') as out_file:
            content = await file.read()  # async read
            await out_file.write(content)

    # shennong the devil outta them:
    for file in files:
        await analyser (file.filename, subdir, y_fts, settings)
        
    # collect results files in /tmp/{}/results into a zip file:
    suffix = str(datetime.date.today())
    results = os.listdir("/tmp/{}/results/".format(subdir))
    with ZipFile("/tmp/results/results_{}_{}.zip".format(subdir,suffix), "w") as zip:
        for r in results:
            zip.write(r)
    
    # clean out submitter's files (except results, which are saved in "results" directory):
    shutil.rmtree("/tmp/{}".format(subdir))
    
    # return results for download:
    return FileResponse("tmp/results/results_{}_{}.zip".format(subdir,suffix), media_type="application/octet-stream", filename="ShennongOnline_results_{}.zip".format(suffix))
    ## media_type value here specifies that browser needs open a file download dialog 
 
 