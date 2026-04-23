-- dbo.clin_basic_2_view



/* view clin_basic_2_view: add view */


/* view clin_basic_2_view: add view */


/* view clin_basic_2_view: add view */

/* view clin_basic_2_view: add view */


/* view clin_basic_2_view: add view */


/* view clin_basic_2_view: add view */


/* view clin_basic_2_view: add view */
CREATE VIEW [dbo].[clin_basic_2_view]
AS
SELECT        dbo.gduset_1_view.d_code_ka7 AS d_code_prm, dbo.gduset_1_view.d_name_ka7 AS d_name_prm, dbo.gduset_1_view.idnk12_ka7 AS idnk12_prm, dbo.clin_basic_1_view.a_code_k31, 
                         dbo.clin_basic_1_view.cntrct_k79, dbo.clin_basic_1_view.rqmtyp_k79, dbo.clin_basic_1_view.cntdte_k79, dbo.clin_basic_1_view.rel_no_k80, dbo.clin_basic_1_view.reldte_k80, 
                         dbo.clin_basic_1_view.cntpri_k80, dbo.clin_basic_1_view.clnact_k80, dbo.clin_basic_1_view.relext_k80, dbo.clin_basic_1_view.rlssta_k80, dbo.clin_basic_1_view.fmscno_k80, dbo.clin_basic_1_view.critcl_k80, 
                         dbo.clin_basic_1_view.clinno_k81, dbo.clin_basic_1_view.tacode_k80, dbo.clin_basic_1_view.mrqsta_k81, dbo.clin_basic_1_view.shpsta_k81, dbo.clin_basic_1_view.clnext_k81, 
                         dbo.clin_basic_1_view.pr_num_k81, dbo.clin_basic_1_view.reqdly_k81, dbo.clin_basic_1_view.rddcod_k81, dbo.clin_basic_1_view.clnqty_k81, dbo.clin_basic_1_view.coq_01_k81, 
                         dbo.clin_basic_1_view.cln_up_k81, dbo.clin_basic_1_view.cln_ui_k81, dbo.clin_basic_1_view.qfactr_k81, dbo.clin_basic_1_view.tcn_k81, dbo.clin_basic_1_view.tcnpri_k81, dbo.clin_basic_1_view.cage_k13, 
                         dbo.clin_basic_1_view.prtnum_k71, dbo.clin_basic_1_view.pn_rev_k71, dbo.clin_basic_1_view.p_desc_k71, dbo.clin_basic_1_view.fsc_k08, dbo.clin_basic_1_view.niin_k08, dbo.clin_basic_1_view.weight_k08, 
                         dbo.clin_basic_1_view.trmdes_k06, dbo.clin_basic_1_view.idnk06_k06, dbo.clin_basic_1_view.idnk08_k08, dbo.clin_basic_1_view.idnk13_k13, dbo.clin_basic_1_view.idnk31_k31, 
                         dbo.clin_basic_1_view.idnk71_k71, dbo.clin_basic_1_view.idnk79_k79, dbo.clin_basic_1_view.idnk80_k80, dbo.clin_basic_1_view.idnk81_k81, dbo.clin_basic_1_view.ordrno_k81, 
                         dbo.clin_basic_1_view.fob_od_k81, dbo.clin_basic_1_view.ins_sd_k81, dbo.clin_basic_1_view.acc_sd_k81, dbo.clin_basic_1_view.addtme_k81, dbo.clin_basic_1_view.faspay_k80, 
                         dbo.clin_basic_1_view.prjcod_k81, dbo.clin_basic_1_view.prsmth_k81, dbo.clin_basic_1_view.upkqty_k81, dbo.clin_basic_1_view.inrvws_k81, dbo.clin_basic_1_view.piidno_k80, 
                         dbo.clin_basic_1_view.docntr_k80, dbo.clin_basic_1_view.c_name_k31
FROM            dbo.gduset_1_view INNER JOIN
                         dbo.clin_basic_1_view ON dbo.gduset_1_view.idngdu_ka6 = dbo.clin_basic_1_view.idnk80_k80
WHERE        (dbo.gduset_1_view.gdutbl_ka6 = 'k80') AND (dbo.gduset_1_view.gduset_ka7 = 'MIRR Block 9. Prime Contractor')







