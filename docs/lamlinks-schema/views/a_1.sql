-- dbo.a_1



/* view a_1: add view */


/* view a_1: add view */


/* view a_1: add view */

/* view a_1: add view */


/* view a_1: add view */


/* view a_1: add view */
CREATE VIEW [dbo].[a_1]
AS
SELECT        K31_tab.a_code_k31, K79_tab.cntrct_k79, K79_tab.rqmtyp_k79, K79_tab.cntdte_k79, K80_tab.rel_no_k80, K80_tab.reldte_k80, K80_tab.cntpri_k80, K80_tab.clnact_k80, K80_tab.relext_k80, K80_tab.rlssta_k80, 
                         K80_tab.fmscno_k80, K80_tab.critcl_k80, K81_tab.clinno_k81, K80_tab.tacode_k80, K81_tab.mrqsta_k81, K81_tab.shpsta_k81, K81_tab.clnext_k81, K81_tab.pr_num_k81, K81_tab.reqdly_k81, 
                         K81_tab.rddcod_k81, K81_tab.clnqty_k81, K81_tab.coq_01_k81, K81_tab.cln_up_k81, K81_tab.cln_ui_k81, K81_tab.qfactr_k81, K81_tab.tcn_k81, K81_tab.tcnpri_k81, K06_tab.trmdes_k06, K81_tab.ordrno_k81, 
                         K81_tab.fob_od_k81, K81_tab.ins_sd_k81, K81_tab.acc_sd_k81, K81_tab.addtme_k81, K80_tab.faspay_k80, K81_tab.prjcod_k81, K81_tab.prsmth_k81, K81_tab.upkqty_k81, K81_tab.inrvws_k81, 
                         K80_tab.piidno_k80, K80_tab.docntr_k80, K31_tab.c_name_k31, K81_tab.idnk71_k81, K79_tab.idnk79_k79, K80_tab.idnk80_k80, K81_tab.idnk81_k81, K31_tab.idnk31_k31, K06_tab.idnk06_k06
FROM            dbo.k31_tab AS K31_tab INNER JOIN
                         dbo.k79_tab AS K79_tab ON K31_tab.idnk31_k31 = K79_tab.idnk31_k79 INNER JOIN
                         dbo.k80_tab AS K80_tab ON K79_tab.idnk79_k79 = K80_tab.idnk79_k80 INNER JOIN
                         dbo.k81_tab AS K81_tab ON K80_tab.idnk80_k80 = K81_tab.idnk80_k81 LEFT OUTER JOIN
                         dbo.k06_tab AS K06_tab ON K80_tab.idnk06_k80 = K06_tab.idnk06_k06






