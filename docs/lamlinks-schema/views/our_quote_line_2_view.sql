-- dbo.our_quote_line_2_view



/* view our_quote_line_2_view: add view */


/* view our_quote_line_2_view: add view */


/* view our_quote_line_2_view: add view */

/* view our_quote_line_2_view: add view */


/* view our_quote_line_2_view: add view */


/* view our_quote_line_2_view: add view */


/* view our_quote_line_2_view: add view */


/* view our_quote_line_2_view: add view */


/* view our_quote_line_2_view: add view */


/* view our_quote_line_2_view: add view */
/* view our_quote_line_2_view: add view 
 view our_quote_line_2_view: add view 
 view our_quote_line_2_view: add view 
 view our_quote_line_2_view: add view 
 view our_quote_line_2_view: add view 
 view our_quote_line_2_view: add view 
 view our_quote_line_2_view: add view 
 view our_quote_line_2_view: add view */
CREATE VIEW [dbo].[our_quote_line_2_view]
AS
SELECT        dbo.customer_demographics_1_view.gduset_ka7, dbo.our_quote_line_1_view.t_stat_k33, dbo.our_quote_line_1_view.valday_k34, dbo.our_quote_line_1_view.qty_k35, dbo.our_quote_line_1_view.up_k35, 
                         dbo.our_quote_line_1_view.daro_k35, dbo.our_quote_line_1_view.qty_ui_k34, dbo.our_quote_line_1_view.sol_no_k10, dbo.our_quote_line_1_view.fsc_k08, dbo.our_quote_line_1_view.niin_k08, 
                         dbo.our_quote_line_1_view.p_desc_k08, dbo.our_quote_line_1_view.uptime_k34, dbo.customer_demographics_1_view.d_attn_ka7, dbo.customer_demographics_1_view.d_emal_ka7, 
                         dbo.our_quote_line_1_view.qrefno_k34, dbo.our_quote_line_1_view.pn_k34, dbo.our_quote_line_1_view.bidtyp_k34, dbo.our_quote_line_1_view.idnk08_k08, dbo.our_quote_line_1_view.insmat_k34, 
                         dbo.our_quote_line_1_view.pn_rev_k34, dbo.our_quote_line_1_view.gennte_k34, dbo.our_quote_line_1_view.szip_k34, dbo.our_quote_line_1_view.idnk34_k34, dbo.k14_tab.u_name_k14, 
                         dbo.k14_tab.idnk14_k14, dbo.customer_demographics_1_view.d_code_ka7, dbo.customer_demographics_1_view.d_name_ka7, dbo.our_quote_line_1_view.trmdes_k34, dbo.k12_tab.idnk12_k12 AS idnk12_mfg, 
                         dbo.customer_demographics_1_view.idnk12_k12 AS idnk12_too, dbo.our_quote_line_1_view.mcage_k34, dbo.our_quote_line_1_view.fobcod_k34, dbo.our_quote_line_1_view.idnk35_k35, 
                         dbo.our_quote_line_1_view.qtek14_k34, dbo.customer_demographics_1_view.idnka7_ka7
FROM            dbo.our_quote_line_1_view INNER JOIN
                         dbo.customer_demographics_1_view ON dbo.our_quote_line_1_view.idnk31_k10 = dbo.customer_demographics_1_view.idnk31_k31 INNER JOIN
                         dbo.k14_tab ON dbo.our_quote_line_1_view.qtek14_k34 = dbo.k14_tab.idnk14_k14 LEFT OUTER JOIN
                         dbo.k12_tab ON dbo.our_quote_line_1_view.mcage_k34 = dbo.k12_tab.e_code_k12










