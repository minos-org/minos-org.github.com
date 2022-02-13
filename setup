#!/bin/sh

VERSION="2022.02.12-11:03"
LINER="$ sudo sh <(wget -qO- minos.io/s)"

################################################################################
# Colors #######################################################################
################################################################################

DEFAULT="$(printf "\\033[0;39m")"
WHITE_BOLD="$(printf "\\033[1m")"
WHITE_BG="$(printf "\\033[7m")"
RED="$(printf "\\033[0;31m")"

################################################################################
# General functions ############################################################
################################################################################

_animate_while() {
    [ -z "${1}" ] && { printf "%5s\n" ""; return 1; }

    if ! printf "%s" "$(pidof "${1}")" | grep "[0-9].*" >/dev/null; then
        printf "%5s\n" ""
        return 1;
    fi

    _awhile__animation_state="1"

    if [ ! "$(ps -p "$(pidof "${1}")" -o comm= 2>/dev/null)" ]; then
        printf "%5s\n" ""
        return 1
    fi

    printf "%5s" ""

    while [ "$(ps -p "$(pidof "${1}")" -o comm= 2>/dev/null)" ]; do
        printf "%b" "\b\b\b\b\b"
        case "${_awhile__animation_state}" in
            1) printf "%s" '\o@o\'
               _awhile__animation_state="2" ;;
            2) printf "%s" '|o@o|'
               _awhile__animation_state="3" ;;
            3) printf "%s" '/o@o/'
               _awhile__animation_state="4" ;;
            4) printf "%s" '|o@o|'
               _awhile__animation_state="1" ;;
        esac
        sleep 1
    done
    printf "%b" "\b\b\b\b\b" && printf "%5s\n" ""
}

_basename() {
    [ -z "${1}" ] && return 1 || _basename_var_name="${1}"
    [ -z "${2}" ] || _basename_var_suffix="${2}"
    case "${_basename_var_name}" in
        /*|*/*) _basename_var_name="$(expr "${_basename_var_name}" : '.*/\([^/]*\)')" ;;
    esac

    if [ -n "${_basename_var_suffix}" ] && [ "${#_basename_var_name}" -gt "${#2}" ]; then
        if [ X"$(printf "%s" "${_basename_var_name}" | cut -c"$((${#_basename_var_name} - ${#_basename_var_suffix} + 1))"-"${#_basename_var_name}")" \
           = X"$(printf "%s" "${_basename_var_suffix}")" ]; then
            _basename_var_name="$(printf "%s" "${_basename_var_name}" | cut -c1-"$((${#_basename_var_name} - ${#_basename_var_suffix}))")"
        fi
    fi

    printf "%s\\n" "${_basename_var_name}"
}

_is_root() {
    [ X"$(whoami)" = X"root" ]
}

_printfl() { #print lines
    command -v "tput" >/dev/null 2>&1 && _printfl_var_max_len="$(tput cols)"
    _printfl_var_max_len="${_printfl_var_max_len:-80}"
    if [ -n "${1}" ]; then
        _printfl_var_word_len="$(expr "${#1}" + 2)"
        _printfl_var_sub="$(expr "${_printfl_var_max_len}" - "${_printfl_var_word_len}")"
        _printfl_var_half="$(expr "${_printfl_var_sub}" / 2)"
        _printfl_var_other_half="$(expr "${_printfl_var_sub}" - "${_printfl_var_half}")"
        printf "%b" "${WHITE_BOLD}"
        printf '%*s' "${_printfl_var_half}" '' | tr ' ' -
        printf "%b" "${WHITE_BG}" #white background
        printf " %s " "${1}"
        printf "%b" "${DEFAULT}${WHITE_BOLD}"
        printf '%*s' "${_printfl_var_other_half}" '' | tr ' ' -
        printf "%b" "${DEFAULT}" #back to normal
        printf "\\n"
    else
        printf "%b" "${WHITE_BOLD}"
        printf '%*s' "${_printfl_var_max_len}" '' | tr ' ' -
        printf "%b" "${DEFAULT}"
        printf "\\n"
    fi
}

_printfs() { #print steps
    [ -z "${1}" ] && return 1
    printf "%s\\n" "[+] ${*}"
}

_printfc() { #print commands
    [ -z "${1}" ] && return 1
    printf "%s\\n" "    $ ${*}"
}

_unprintf() { #unprint sentence
    [ -z "${1}" ] && return 1
    printf "\\r"
    for i in $(seq 0 "${#1}"); do printf " "  ; done
    printf "\\r"
}

_printf_sleep() {
    [ -z "${2}" ] && return 1
    _ps__string="${1} "
    _ps__secs="${2}"

    while [ "${_ps__secs}" -gt "0" ]; do
        _unprintf "${_ps__string}"
        printf "%s\\n" "${_ps__string}" | sed "s:X:${_ps__secs}:g" | tr -d '\n'
        sleep 1 || {
            _unprintf "${_ps__string}"
            return 1
        }
        _ps__secs="$((_ps__secs - 1))"
    done
    _unprintf "${_ps__string}"
}

_distro() { #return distro name in lower case
    _distro__DIST_INFO="/etc/lsb-release"
    if [ -r "${_distro__DIST_INFO}" ]; then
        . "${_distro__DIST_INFO}"
    fi

    if [ -z "${DISTRIB_ID}" ]; then
        _distro__DISTRIB_ID="Unknown";
        if [ -r /etc/debian_version ]; then
            _distro__DISTRIB_ID="Debian"
        elif [ -r /etc/issue ]; then
            _distro__DISTRIB_ID="$(awk '{print $1}' /etc/issue.net)"
            if [ X"${_distro__DISTRIB_ID}" = X"Ubuntu" ]; then
                _distro__DISTRIB_ID="Ubuntu"
            fi
        fi
        printf "%s\\n" "${_distro__DISTRIB_ID}" | tr 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' 'abcdefghijklmnopqrstuvwxyz'
    else
        printf "%s\\n" "${DISTRIB_ID}" | tr 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' 'abcdefghijklmnopqrstuvwxyz'
    fi
}

_hooks() {
    [ -z "${1}" ] && return 1
    case "${1}" in
        A|B|C)
            for _hooks_var_script in "${HOME}"/.minos/hooks/"${1}"*; do
                break
            done

            if [ -f "${_hooks_var_script}" ]; then
                _printfl "Executing ${1} hooks"
            else
                return 1
            fi

            for _hooks_var_script in "${HOME}"/.minos/hooks/"${1}"*; do
                if [ -f "${_hooks_var_script}" ]; then
                    _printfs "${_hooks_var_script} ..."
                    . "${_hooks_var_script}"
                fi
            done
            ;;
    esac
}

_get_release() {
    if [ -n "${RELEASE}" ]; then
        _grelease__release="${RELEASE}"
    elif command -v "lsb_release" 1>/dev/null 2>&1; then
        _grelease__release="$(lsb_release -cs)"
    else
        if [ -f /etc/apt/sources.list ]; then
            _grelease__release="$(awk -F" " '/^deb .*/ {print $3; exit}' /etc/apt/sources.list)"
        fi
    fi

    if [ -z "${_grelease__release}" ]; then
        _die "Release cannot be determinated, please specify --release"
    fi

    printf "%s\\n" "${_grelease__release}"
}

_get_release_number() {
    case "${1}" in
        xenial) _grn__number="16.04" ;;
        bionic) _grn__number="18.04" ;;
         focal) _grn__number="20.04" ;;
    esac
    printf "%s\\n" "${_grn__number}"
}

_get_arch() {
    if [ -n "${ARCH}" ]; then
        _garch="${ARCH}"
    elif command -v "dpkg" 1>/dev/null 2>&1; then
        _garch="$(dpkg --print-architecture)"
    else
        if [ -z "${MACHTYPE}" ]; then
            _garch="$(uname -m)"
        else
            _garch="$(printf "%s\\n" "${MACHTYPE}" | cut -d- -f1)"
        fi

        case "${_garch}" in
            x86_64) _garch="amd64" ;;
                 *) _garch="i386"  ;;
        esac
    fi

    printf "%s\\n" "${_garch}"
}

_fetch_file() {
    [ -z "${1}" ] && return 1 || _ffile__url="${1}"
    [ -z "${2}" ] && _ffile__output="" || _ffile__output="${2}"
    _ffile__max_tries="10"

    _ffile__i="0"
    while [ "${_ffile__i}" -lt "${_ffile__max_tries}" ]; do
        _ffile__i="$((_ffile__i + 1))"

        if [ -z "${_ffile__output}" ]; then
            _cmd_animate wget "${_ffile__url}"
        else
            _cmd_animate wget "${_ffile__url}" -O "${_ffile__output}"
        fi

        if [ -n "${_ffile__output}" ] && [ -f "${_ffile__output}" ]; then
            break
        elif [ -z "${_ffile__output}"]; then
            if [ -f "./$(_basename "${_ffile__url}")" ] || [ -f index.html ]; then
                break
            fi
        else
            if [ "${_ffile__i}" -eq "$((_ffile__max_tries - 1))" ]; then
                printf "%s" "Impossible to retrive files"
                exit 1
            else
                printf "[-] %s" "${_ffile__url} seems down, retrying in ${_ffile__i} minute(s) ..."
                sleep "$(expr "${_ffile__i}" \* 60)"
                printf "\\n"
            fi
        fi
    done
}

_exists_apt_proxy() { #look for apt proxies, return 0 on sucess, 1 otherwise
    avahi-browse -a  -t | grep apt-cacher-ng >/dev/null && return 0
    return 1
}

_die() { #print a stacktrace with a msg, exits with 1
    if [ -n "${BASH}" ]; then
        _die__frame="0"
        while caller "${_die__frame}"; do
            _die__frame="$(expr "${_die__frame}" + 1)"
        done
    fi

    printf "%b\\n" "${RED}${*}${DEFAULT}" >&2
    exit 1
}

_seconds2human() {
    [ -z "${1}" ] && return 1
    printf "%s\\n" "${1}" | grep -v "[^0-9]" >/dev/null || return 1;

    _s2h__num="${1}"
    _s2h__min="0"
    _s2h__hour="0"
    _s2h__day="0"

    if [ "${_s2h__num}" -gt "59" ]; then
        _s2h__sec="$((${_s2h__num} % 60))"
        _s2h__num="$((${_s2h__num} / 60))"
        if [ "${_s2h__num}" -gt "59" ]; then
            _s2h__min="$((${_s2h__num} % 60))"
            _s2h__num="$((${_s2h__num} / 60))"
            if [ "${_s2h__num}" -gt "23" ]; then
                _s2h__hour="$((${_s2h__num} % 24))"
                _s2h__day="$((${_s2h__num} / 24))"
            else
                _s2h__hour="${_s2h__num}"
            fi
        else
            _s2h__min="${_s2h__num}"
        fi
    else
        _s2h__sec="${_s2h__num}"
    fi

    [ "${_s2h__day}"  -gt 0 ] && printf "%s" "${_s2h__day}d "
    [ "${_s2h__hour}" -gt 0 ] && printf "%s" "${_s2h__day}h "
    [ "${_s2h__min}"  -gt 0 ] && printf "%s" "${_s2h__min}m "
    printf "%s" "${_s2h__sec}s"
    printf "\\n"
}

_apt_update() {
    [ -z "${1}" ] && _aupdate__cache_seconds="3600" || _aupdate__cache_seconds="${1}"
    _aupdate__cache_file="/var/cache/apt/pkgcache.bin"
    if [ -f "${_aupdate__cache_file}" ]; then
        _aupdate__last="$(stat -c %Y "${_aupdate__cache_file}")"
        _aupdate__now="$(date +'%s')"
        _aupdate__diff="$(($_aupdate__now - $_aupdate__last))"
        if [ "${_aupdate__diff}" -lt "${_aupdate__cache_seconds}" ]; then
            _printfs "apt-get update was recently used ($(_seconds2human "${_aupdate__diff}") ago), skipping ..."
        else
            _cmd_verbose apt-get update
        fi
    else
        _cmd_verbose apt-get update
    fi
}

_cmd() { #print and execute a command, exit on fail
    [ -z "${1}" ] && return 1
    printf "%s \\n" "    $ ${*}"
    _cmd_var_output="$(eval ${@} 2>&1)"
    _cmd_var_status="${?}"
    if [ X"${_cmd_var_status}" != X"0" ]; then
        printf "> %s:%s" "${*}" "${_cmd_var_output}"
        printf "\\n"
        exit "${_cmd_var_status}"
    else
        return "${_cmd_var_status}"
    fi
}

_cmd_verbose() {
    [ -z "${1}" ] && return 1
    printf "%s \\n" "    $ ${*}"
    $@ || _die "there was an error with the above command, exiting ..."
}

_cmd_animate() { #print, execute and wait for a command to finish
    [ -z "${1}" ] && return 1
    printf "%s " "    $ ${@} ..."
    eval "${@}" >/dev/null 2>&1 &
    sleep 1s
    _animate_while "${1}"
}

_last_cmd_ok() {
    [ X"${?}" = X"0" ]
}

_supported() { #retun 0 on a supported system, 1 otherwise
    #be way more flexible in live mode, minos
    #should be installable from any unix environment
    case "${mode}" in
        live) return 0 ;;
    esac

    SUPPORTED="[Debian|Ubuntu]"
    case "$(_distro)" in
        ubuntu|debian) return 0 ;;
    esac
    return 1
}

_install_apt_proxy() {
    _printfs "Setting up an apt-get proxy ..."

    _apt_update 3600
    _cmd_animate apt-get install --no-install-recommends -y avahi-utils

    if _exists_apt_proxy; then
        _iap__apt_proxy_server="$(avahi-browse -a -t -r -p | awk -F";" '/^=.*apt-cacher-ng/ {print $8}')"
        _printfs "exists an apt-get proxy at ${_iap__apt_proxy_server}, setting up the client ..."
        _cmd_animate apt-get install --no-install-recommends -y squid-deb-proxy-client
    else
        _printfs "no apt-get proxy found, installing one locally ..."
        _cmd_animate apt-get install --no-install-recommends -y squid-deb-proxy-client apt-cacher-ng

        if [ ! -f /etc/avahi/services/apt-cacher-ng.service ]; then
            _cmd mkdir -p /etc/avahi/services/
            cat > /etc/avahi/services/apt-cacher-ng.service << 'E=O=F'
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
 <name replace-wildcards="yes">apt-cacher-ng proxy on %h</name>
 <service protocol="ipv4">
  <type>_apt_proxy._tcp</type>
  <port>3142</port>
 </service>
</service-group>
E=O=F
        fi

        if [ -d "${HOME}"/misc/deb-proxy/apt-cacher-ng/ ]; then
            _printfs "Exporting files ..."
            _cmd rm -rf /var/cache/apt-cacher-ng
            _cmd ln -s "${HOME}"/misc/deb-proxy/apt-cacher-ng/ /var/cache/apt-cacher-ng
        fi
    fi
}

_header() {
    _printfl "Minos Setup"
    printf "%b\\n" "${WHITE_BOLD}Version: ${DEFAULT}${VERSION}"
    printf "\\n"
    printf "%b\\n" "${WHITE_BOLD} ${cx} Core         ${DEFAULT}${LINER} core"
    printf "%b\\n" "${WHITE_BOLD} ${dx} Desktop      ${DEFAULT}${LINER} desktop"
    printf "%b\\n""${WHITE_BOLD} ${lcx} Live Core    ${DEFAULT}${LINER} live core    /dev/sdX username passwd [/dev/sdaY] "
    printf "%b\\n""${WHITE_BOLD} ${ldx} Live Desktop ${DEFAULT}${LINER} live desktop /dev/sdX username passwd [/dev/sdaY]"
    printf "\\n\\n"
    printf "%s\\n" "  /dev/sdX → /     mount point"
    printf "%s\\n" "  /dev/sdY → /home mount point (optional)"
    printf "\\n"
    printf "%s\\n" "  --release  [16.04|18.04|20.04]"
    _printfl
}

_die_sendmail() { #apt-get purge doesn't kill sendmail instances
    _dsendmail__pid="$(ps -aef | awk '$0 ~ "sendmail" {if ($0 !~ "awk") print $2}')"
    if [ -n "${_dsendmail__pid}" ]; then
        _printfs 'die sendmail, die!!'
        _cmd kill "${_dsendmail__pid}"
    fi
}

_cleanup() {
    [ "${_cleanup__init}" ] && return
    _cleanup__init="done"
    stty echo
    printf "\\n"
    _printfl "Cleanup"
    _recover_original_reps
    [ -z "${1}" ] && exit
}

_backup_original_reps() { #create a backup of /etc/apt/sources.list.d/* files
    for _boreps__file in /etc/apt/sources.list.d/*.list; do
        break
    done
    [ -f "${_boreps__file}" ] && _printfs "disabling temporaly non standard repos ..."
    for _boreps__file in /etc/apt/sources.list.d/*.list; do
        if [ -f "${_boreps__file}" ]; then
            _cmd mv "${_boreps__file}" "${_boreps__file}".backup_rep
        fi
    done
    _tweak_apt_get
}

_recover_original_reps() { #recover files at /etc/apt/sources.list.d/*
    for _roreps__file in /etc/apt/sources.list.d/*.list.backup_rep; do
        break
    done
    [ -f "${_roreps__file}" ] && _printfs "recovering non standard repos ..."
    for _roreps__file in /etc/apt/sources.list.d/*.list.backup_rep; do
        if [ -f "${_roreps__file}" ]; then
            _cmd mv "${_roreps__file}" "${_roreps__file%.backup_rep}"
        fi
    done
}

_add_repository() { #ensure rep is enabled
    [ -z "${1}" ] && return 1
    [ -z "${2}" ] && _arepository__key="" || _arepository__key="${2}"

    _arepository__baseurl="$(printf "%s" "${1}" | cut -d' ' -f2 | grep "//")"
    if [ -z "$(printf "%s" "${1}" | cut -d' ' -f3)" ] || [ -z "${_arepository__baseurl}" ]; then
        _die "Bad formated repository: ${1}"
    fi

    [ ! -d /etc/apt/sources.list.d ] && _cmd mkdir /etc/apt/sources.list.d
    if [ -z "${_arepository__list}" ]; then
        _arepository__extras=/etc/apt/sources.list.d/*.list

        for _arepository__extra in ${_arepository__extras}; do
            break
        done

        if [ -e "${_arepository__extra}" ]; then
            _arepository__list="$(grep -h ^deb /etc/apt/sources.list /etc/apt/sources.list.d/*.list)"
        else
            _arepository__list="$(grep -h ^deb /etc/apt/sources.list)"
        fi
    fi

    case "${_arepository__baseurl}" in
        *archive.ubuntu.com*)
            _arepository__regex="$(printf "%s" "${1}" | cut -d' ' -f3-4 | sed 's: :.*:g')"
            _arepository__name="$(printf "%s" "${1}"  | cut -d' ' -f3-4 | tr ' ' '-')"
            ;;
        *)
            _arepository__regex="${_arepository__baseurl}"
            if [ -n "$(printf "%s" "${_arepository__baseurl}" | cut -d'/' -f5)" ]; then
                _arepository__name="$(printf "%s" "${_arepository__baseurl}" \
                                     | cut -d'/' -f4-5 | tr '/' '-')"
            else
                _arepository__name="$(printf "%s" "${_arepository__baseurl}" \
                                     | cut -d'/' -f3-4 | tr '/' '-')"
            fi
            if [ -z "$(printf "%s" "${1}" | cut -d' ' -f4)" ]; then
                _arepository__name="$(printf "%s" "${_arepository__baseurl}" \
                    | cut -d'/' -f 3 | awk -F. '{print $(NF-1)}')"-"${_arepository__name}"
            fi
            ;;
    esac

    if ! printf "%s" "${_arepository__list}" | grep "${_arepository__regex}" >/dev/null; then
        printf "%s\\n" "${1}" > /tmp/"${_arepository__name}".list
        _cmd mv /tmp/"${_arepository__name}".list /etc/apt/sources.list.d/
        if [ -n "${_arepository__key}" ]; then
            if printf "%s" "${_arepository__key}" | grep "http" >/dev/null; then
                _fetch_file ${_arepository__key} /tmp/keyfile.asc
                _cmd_verbose apt-key add /tmp/keyfile.asc
                _cmd_verbose rm -rf /tmp/keyfile.asc
            else
                _cmd_verbose apt-get install --no-install-recommends -y gnupg
                _cmd_verbose apt-key adv --keyserver keyserver.ubuntu.com \
                    --recv-keys "${_arepository__key}"
            fi
        fi
    fi
}

_virt_what() { #check for virtualization systems, returns technology used
    if [ -d /proc/vz ] && [ ! -d /proc/bc ]; then
        printf "openvz"
    elif grep 'UML' /proc/cpuinfo >/dev/null 2>&1; then
        printf "uml"
    elif [ -f /proc/xen/capabilities ]; then
        printf "xen"
    elif grep 'QEMU' /proc/cpuinfo >/dev/null 2>&1; then
        printf "qemu"
    elif grep 'Hypervisor detected' /var/log/dmesg >/dev/null 2>&1; then
        awk '/Hypervisor detected/ {print tolower($NF); exit; }' /var/log/dmesg
    fi
    return 1
}

_tweak_apt_get() {
    printf "\033[1A" #override previous line
    _printfl "Tweaking apt-get"
    printf "%s\\n" '    $ printf "%s\n" "Dir::Ignore-Files-Silently:: "(.save|.distUpgrade|.backup_rep)$";" > /tmp/minos-apt-99ignoresave'
    printf "%s"    'Dir::Ignore-Files-Silently:: "(.save|.distUpgrade|.backup_rep)$";' > /tmp/minos-apt-99ignoresave
    _cmd mv /tmp/minos-apt-99ignoresave /etc/apt/apt.conf.d/99ignoresave

    #we're about to install many packages, speed up the process for surrounding machines
    #TODO 16-09-2021 20:03 >> recent Ubuntu versions require additional settings
    #to install this in non interactive mode
    #_install_apt_proxy
}

_add_minos_repository() {
    _printfl "Adding repositories"
    _add_repository "deb http://ppa.launchpad.net/minos-archive/main/ubuntu ${1} main" "4A06406469B4B061"
    _add_repository "deb http://archive.ubuntu.com/ubuntu/ ${1} multiverse"
    _add_repository "deb http://archive.ubuntu.com/ubuntu/ ${1}-updates multiverse"
    _apt_update 0
}

_install_debootstrap() {
    _idebootstrap__tmpdir="/tmp/debootstrap_$$"
    _cmd_verbose mkdir -p "${_idebootstrap__tmpdir}"

    (
        _cmd_verbose cd "${_idebootstrap__tmpdir}"
        #https://packages.ubuntu.com/focal/debootstrap
        _cmd_verbose wget -q http://mirrors.kernel.org/ubuntu/pool/main/d/debootstrap/debootstrap_1.0.118ubuntu1_all.deb
        _cmd_verbose busybox ar -x debootstrap_1.0.118ubuntu1_all.deb
        _cmd_verbose cd /
        _cmd_verbose tar zxf "${_idebootstrap__tmpdir}/data.tar.gz"
    )

    _cmd_verbose command -v "debootstrap"
    _cmd_verbose rm -rf "${_idebootstrap__tmpdir}"
}

################################################################################
# Deployment functions #########################################################
################################################################################

_core() {
    if [ -n "$(_get_release)" ]; then
        _backup_original_reps
        _add_minos_repository "$(_get_release)"
    else
        _die "Couldn't find valid release"
    fi

    _printfs "Installing packages ..."
    #_cmd_animate apt-get install --no-install-recommends -y minos-core
    _cmd_verbose apt-get install --no-install-recommends -y --force-yes minos-core
    _recover_original_reps

    _printfs "Removing leftovers  ..."
    _cmd_animate apt-get purge -y squid-deb-proxy-client apt-cacher-ng
    _cmd_animate apt-get autoremove

    _printfl "DONE"
    printf "\\n%s\\n" "Reload your session or relogin to get started, have fun! n@n/"
    printf "%s\\n"    "    $ source ~/.bashrc"
}

_desktop() {
    if [ -n "$(_get_release)" ]; then
        _backup_original_reps
        _add_minos_repository "$(_get_release)"
    else
        _die "Couldn't find valid release"
    fi

    _printfs "Installing packages ..."
    #_cmd_animate DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y minos-desktop
    _cmd_verbose export DEBIAN_FRONTEND=noninteractive
    _cmd_verbose apt-get install --no-install-recommends -y --force-yes minos-desktop
    #[ -d "${HOME}"/.gvfs ] && fusermount -u "${HOME}"/.gvfs
    _recover_original_reps

    _printfl "DONE"
    printf   "\\n%s\\n" "Restart your computer to get started, have fun!, n@n/"
}

_live() {
    _live__release="$(_get_release)"
    _live__rnumber="$(_get_release_number "${_live__release}")"
    _live__arch="$(_get_arch)"
    _live__root_partition="${root_partition}"
    _live__home_partition="${home_partition}"
    _live__grub_partition="$(printf "%s\\n" "${_live__root_partition}"|sed 's:[0-9]::g')"
    _live__username="${username}"
    _live__passwd="${passwd}"
    _live__tmp_mnt="/minos"
    _live__swap="$(blkid|awk '/swap/&&/PART/{print $1;exit;}'|sed 's/://g')"
    _live__secs="10"

    printf "\033[1A" #override previous line
    _printfl "Minos Live Installer"
    printf "%b\\n" "${WHITE_BOLD}Release:     ${DEFAULT}${_live__release} / ${_live__rnumber}"
    printf "%b\\n" "${WHITE_BOLD}Arch:        ${DEFAULT}${_live__arch}"
    printf "%b\\n" "${WHITE_BOLD}Target:      ${DEFAULT}${_live__tmp_mnt}"
    printf "\\n"
    printf "%b\\n" "${WHITE_BOLD}/ partition: ${DEFAULT}${_live__root_partition}"
    if [ -n "${_live__home_partition}" ]; then
        printf "%b\\n" "${WHITE_BOLD}/home  part: ${DEFAULT}${_live__home_partition}"
    fi
    printf "%b\\n" "${WHITE_BOLD}Grub:        ${DEFAULT}${_live__grub_partition}"
    printf "%b\\n" "${WHITE_BOLD}Swap:        ${DEFAULT}${_live__swap:-None}"
    printf "\\n"
    printf "%b\\n" "${WHITE_BOLD}Account:     ${DEFAULT}${_live__username} / $(printf "%s\\n" "${_live__passwd}"|sed 's:.:*:g')"

    _printfl
    _printf_sleep  "Press Ctrl-C to cancel, or wait X seconds to continue ..." "${_live__secs}"

    printf "\033[1A" #override previous line
    _printfl "Bootstrapping"
    if ! command -v "debootstrap" >/dev/null 2>&1; then
        _install_debootstrap
    fi

    umount "${_live__tmp_mnt}/dev"    2>/dev/null || :
    umount "${_live__tmp_mnt}/proc"   2>/dev/null || :
    umount "${_live__tmp_mnt}/sys"    2>/dev/null || :
    umount "${_live__tmp_mnt}/home"   2>/dev/null || :
    umount "${_live__root_partition}" 2>/dev/null || :

    _cmd_verbose mkdir -p "${_live__tmp_mnt}"
    _cmd_verbose mount "${_live__root_partition}" "${_live__tmp_mnt}"

    _cmd_verbose debootstrap --arch "${_live__arch}" "${_live__release}" "${_live__tmp_mnt}"

    cat > "${_live__tmp_mnt}/etc/apt/sources.list" << E=O=F
deb http://archive.ubuntu.com/ubuntu/  ${_live__release} main restricted universe multiverse
deb http://security.ubuntu.com/ubuntu/ ${_live__release}-security main restricted universe multiverse
deb http://archive.ubuntu.com/ubuntu/  ${_live__release}-updates main restricted universe multiverse
E=O=F
    _cmd_verbose sed -i "/cdrom:/d" "${_live__tmp_mnt}/etc/apt/sources.list"

    _printfl "Generating new /etc/fstab file"
    printf "%s\\n" "${_live__root_partition} / ext4 errors=remount-ro 0 1" | tee "${_live__tmp_mnt}/etc/fstab"
    if [ -n "${_live__home_partition}" ]; then
        printf "%s\\n" "${_live__home_partition} /home ext4 errors=remount-ro 0 1" | tee -a "${_live__tmp_mnt}/etc/fstab"
    fi
    printf "%s\\n" "${_live__swap} none swap sw 0 0" | tee -a "${_live__tmp_mnt}/etc/fstab"
    printf "%s\\n" "proc /proc proc  defaults 0 0"   | tee -a "${_live__tmp_mnt}/etc/fstab"
    printf "%s\\n" "sys  /sys  sysfs defaults 0 0"   | tee -a "${_live__tmp_mnt}/etc/fstab"

    _printfl "Chrooting into  ${_live__tmp_mnt}"
    _cmd_verbose mount --bind /dev  "${_live__tmp_mnt}/dev"
    _cmd_verbose mount --bind /proc "${_live__tmp_mnt}/proc"
    _cmd_verbose mount --bind /sys  "${_live__tmp_mnt}/sys"
    if [ -n "${_live__home_partition}" ]; then
        _cmd_verbose mount "${_live__home_partition}" "${_live__tmp_mnt}/home"
    fi

    cat << EOF | chroot "${_live__tmp_mnt}"
    set -xe

    apt-get update
    export DEBIAN_FRONTEND=noninteractive

    printf "%s\\n" "grub-pc grub-pc/install_devices multiselect ${_live__grub_partition}" | debconf-set-selections
    apt-get install --no-install-recommends -y wget grub-pc grub2-common

    apt-get install --no-install-recommends -y linux-generic-hwe-${_live__rnumber} || \
        apt-get install --no-install-recommends -y linux-generic

    adduser --quiet --disabled-password --shell /bin/bash --home "/home/${_live__username}" --gecos "" "${_live__username}"
    printf "%s\\n" "${_live__username}:${_live__passwd}" | chpasswd

    for group in adm cdrom sudo dip plugdev netdev admin; do
        if ! grep -q "\${group}" /etc/group; then
            addgroup "\${group}"
        fi
        usermod -aG "\${group}" "${_live__username}"
    done

    wget -q -O- minos.io/s | sh /dev/stdin ${submode}
    apt-get autoremove

    if [ ! -e /usr/bin/python ]; then
        if   [ -e /usr/bin/python3 ]; then
            ln -s /usr/bin/python3 /usr/bin/python
        elif [ -e /usr/bin/python2 ]; then
            ln -s /usr/bin/python2 /usr/bin/python
        fi
    fi

    if [ X"${RELEASE}" = X"focal" ]; then
        sed -i 's,wicd-curses:terminal,cmst -d,g' /etc/minos/config
    fi

    sed -i -e "/^127.0.0.1/ s:^127.*:127.0.0.1\tminos minos.lan localhost:" /etc/hosts
    echo 'minos' | tee /etc/hostname
    hostnamectl set-hostname 'minos' || :

    sed -i -e '/^XKBMODEL/  s:=.*:="pc105":' /etc/default/keyboard
    sed -i -e '/^XKBLAYOUT/ s:=.*:="latam":' /etc/default/keyboard

    sed -i -e '/^CHARMAP/   s:=.*:="UTF-8":' /etc/default/console-setup
    sed -i -e '/^CODESET/   s:=.*:="guess":' /etc/default/console-setup

    locale-gen en_US.UTF-8
    update-locale LANG=en_US.UTF-8

    #https://stackoverflow.com/a/42344810/890858
    ln -fs /usr/share/zoneinfo/America/Mexico_City /etc/localtime
    dpkg-reconfigure --frontend noninteractive tzdata

    grub-install "${_live__grub_partition}"
    grub-install --recheck "${_live__grub_partition}"
    update-grub

    if [ X"${RELEASE}" = X"focal" ]; then
        update-initramfs -u -k "\$(dpkg --list  | \
            awk '/linux-image/{print \$2;exit}' | sed 's:linux-image-::g')"
        update-grub2
    fi
EOF

    if _last_cmd_ok; then
        set +x
        _printfl "DONE: Reboot the system to get started, have fun!, n.n/"
    fi

#TODO
#hostnamectl set-hostname minos
#dpkg-reconfigure keyboard-configuration
#dpkg-reconfigure tzdata
#locale-gen en_US.UTF-8
#dpkg-reconfigure locales
#dpkg-reconfigure console-data
#dpkg-reconfigure console-setup

#
}

_live_params() {
    [ -z "${4}" ] && return 1 || shift

    case "${1}" in
        c*|d*)
            case "${1}" in
                c*) submode="core"    ;;
                d*) submode="desktop" ;;
            esac; shift
            ;;
        /*) submode="desktop" ;;
    esac

    root_partition="${1}"
    username="${2}"
    passwd="${3}"
    home_partition="${4}"

    if [ ! -e "${root_partition}" ]; then
        _die "${root_partition} doesn't exists → /"
    fi

    if [ -n "${home_partition}" ]; then
        if [ ! -e "${home_partition}" ]; then
            _die "${home_partition} doesn't exists → /home"
        fi
    fi
}

################################################################################
# Parse parameters #############################################################
################################################################################

if [ -z "${1}" ]; then
    mode="core"; cx="\b>"
else
    case "${1}" in
        d*|desktop) mode="desktop"; dx="\b>";;
           l*|live) mode="live"
                    case "${2}" in
                        c*|core)    lcx="\b>";;
                        *|desktop)  ldx="\b>";;
                    esac
                    ;;
            *|core) mode="core";    cx="\b>";;
    esac

    for arg in "${@}"; do #parse options
        case "${arg}" in
            --release)
                if [ "${#}" -gt "1" ]; then
                    case "${2}" in
                        -*) _die "Option '${arg}' requires a parameter" ;;
                    esac; shift

                    case "${1}" in
                        16.04|xenial) RELEASE="xenial" ;;
                        18.04|bionic) RELEASE="bionic" ;;
                        20.04|focal)  RELEASE="focal" ;;
                        *) _header; _die "Invalid release: ${1}"
                    esac; shift
                else
                    _die "Option '${arg}' requires a parameter"
                fi
                ;;
            -*) _header; _die "Invalid option: ${arg}" ;;
            *)  if [ -n "${1}" ]; then
                    args="${args} ${arg}";
                    shift
                fi ;;
        esac
    done
fi

set -- ${args}
################################################################################
# Main #########################################################################
################################################################################

_header
if _supported; then
    case "${mode}" in
        live) _live_params "${@}" || _die "Missing or incorrect parameters" ;;
    esac
    _is_root || _die "You aren't root!, re-run with admin privileges"

    #give the user chance to cancel before starting
    _printf_sleep "Loading components ..." "3" || exit 1

    trap _cleanup INT QUIT #trap ctrl-c
    #the _hook function execute $HOME/.minos/hooks/[LETTER][NUMBER] scripts
    #eg: $HOME/.minos/hooks/A01installextral, $HOME/.minos/hooks/Z01finish
    _hooks A
    case "${mode}" in
           core)  _core    ;;
        desktop)  _desktop ;;
           live)  _live    ;;
    esac
    _hooks Z; : #finish script with 0, independly of latest hooks result
else
    printf "%s %s\\n" "FAILED: Non supported distribution system detected," \
            "run this script on ${SUPPORTED} systems only"
fi

# vim: set ts=8 sw=4 tw=0 ft=sh :
