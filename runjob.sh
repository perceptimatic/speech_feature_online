#! /usr/bin/env bash

set -euo pipefail

# Simple script to test shennong analysis process locally
# Pass in path to audio file you wish to analyze
# Will place config file in /tmp directory for storage before uploading

if [[ $# -ne 1 ]]; then
    echo -e >&2 "USAGE: $0 
        /path/to/audio/file.wav" && exit 1
fi

if [[ ! -f "${1}" ]]; then
    echo >&2 "${1} does not exist!" && exit 1
fi

file_path="${1}"

# pull credentials from project .env file
aws_default_region=$( cat .env | awk -F= '/AWS_DEFAULT_REGION/ {print $2}')
aws_secret_access_key=$( cat .env | awk -F= '/AWS_SECRET_ACCESS_KEY/ {print $2}')
aws_access_key_id=$( cat .env | awk -F= '/AWS_ACCESS_KEY_ID/ {print $2}')
bucket_name=$( cat .env | awk -F= '/BUCKET_NAME/ {print $2}')

#sample analysis config
config_json=$(cat <<EOF
{
    "analyses":{"bottleneck":{"init_args":{"weights":"BabelMulti","dither":0.1},"postprocessors":["delta","vad","cmvn"]},"energy":{"init_args":{"sample_rate":16000,"frame_shift":0.01,"frame_length":0.025,"dither":1,"preemph_coeff":0.97,"remove_dc_offset":true,"window_type":"povey","round_to_power_of_two":true,"blackman_coeff":0.42,"snip_edges":true,"raw_energy":true,"compression":"log"},"postprocessors":["vad","delta","cmvn"]},"filterbank":{"init_args":{"sample_rate":16000,"frame_shift":0.01,"frame_length":0.025,"dither":1,"preemph_coeff":0.97,"remove_dc_offset":true,"window_type":"povey","round_to_power_of_two":true,"blackman_coeff":0.42,"snip_edges":true,"num_bins":23,"low_freq":20,"high_freq":0,"vtln_low":100,"vtln_high":-500,"use_energy":true,"energy_floor":0,"raw_energy":true,"htk_compat":true,"use_log_fbank":true,"use_power":true},"postprocessors":["vad","delta","cmvn"]},"mfcc":{"init_args":{"sample_rate":16000,"frame_shift":0.01,"frame_length":0.025,"dither":1,"preemph_coeff":0.97,"remove_dc_offset":true,"window_type":"povey","round_to_power_of_two":true,"blackman_coeff":0.42,"snip_edges":true,"num_bins":23,"low_freq":20,"high_freq":0,"vtln_low":100,"vtln_high":-500,"num_ceps":13,"use_energy":true,"energy_floor":0,"raw_energy":true,"cepstral_lifter":22,"htk_compat":true},"postprocessors":["vad","delta","cmvn"]},"pitch_crepe":{"init_args":{"model_capacity":"full","viterbi":true,"center":true,"frame_shift":0.01,"frame_length":0.025},"postprocessors":["vad","delta","cmvn","pitch_crepe"]},"pitch_kaldi":{"init_args":{"sample_rate":16000,"frame_shift":0.01,"frame_length":0.025,"min_f0":50,"max_f0":400,"soft_min_f0":10,"penalty_factor":0.1,"lowpass_cutoff":1000,"resample_freq":4000,"delta_pitch":0.005,"nccf_ballast":7000,"lowpass_filter_width":1,"upsample_filter_width":5},"postprocessors":["vad","delta","cmvn","pitch_kaldi"]},"plp":{"init_args":{"sample_rate":16000,"frame_shift":0.01,"frame_length":0.025,"rasta":false,"dither":1,"preemph_coeff":0.97,"remove_dc_offset":true,"window_type":"povey","round_to_power_of_two":true,"blackman_coeff":0.42,"snip_edges":true,"num_bins":23,"low_freq":20,"high_freq":0,"vtln_low":100,"vtln_high":-500,"lpc_order":12,"num_ceps":13,"use_energy":true,"energy_floor":0,"raw_energy":true,"compress_factor":0.3333333333333333,"cepstral_lifter":22,"cepstral_scale":1,"htk_compat":true},"postprocessors":["delta","vad","cmvn"]},"spectrogram":{"init_args":{"sample_rate":16000,"frame_shift":0.01,"frame_length":0.025,"dither":1,"preemph_coeff":0.97,"remove_dc_offset":true,"window_type":"povey","round_to_power_of_two":true,"blackman_coeff":0.42,"snip_edges":true,"energy_floor":0,"raw_energy":true},"postprocessors":["delta","vad","cmvn"]}},
    "channel": 1,
    "files": [],
    "res": ".pkl",
    "save_path": "test/not-random-123.zip"
}
EOF
)

config_key="test-config.json"
file_key="$(basename "${file_path}")"

# put audio file in bucket
docker-compose run --no-deps -v "${file_path}:/tmp/"${file_key}":ro" --entrypoint="python /code/scripts/upload_file.py /tmp/"${file_key}" "${file_key}""  worker

# add audio file path to config and store in host tmp dir
echo $config_json | jq --arg file_key $file_key '.files += [$file_key]' > /tmp/${config_key}

# put config in bucket
docker-compose run --no-deps -v "/tmp/${config_key}:/tmp/${config_key}:ro" --entrypoint="python /code/scripts/upload_file.py /tmp/${config_key} ${config_key}" worker

# argument passed to run script contains config path in s3 and bucket name so it can be retrieved by shennong runner
run_arg_json=$(cat <<EOF
{
    "bucket": "${bucket_name}",
    "config_path": "${config_key}"
}
EOF
)

image="ghcr.io/perceptimatic/sfo-shennong-runner:latest"

# run the job
docker run -it -e "AWS_DEFAULT_REGION=${aws_default_region}" -e "AWS_SECRET_ACCESS_KEY=${aws_secret_access_key}" -e "AWS_ACCESS_KEY_ID=${aws_access_key_id}" --rm "${image}" "${run_arg_json}"
