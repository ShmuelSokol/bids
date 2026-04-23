-- dbo.vendor_quote_4_view



/* view vendor_quote_4_view: add view */


/* view vendor_quote_4_view: add view */
/* view vendor_quote_4_view: add view 
 view vendor_quote_4_view: add view */
CREATE VIEW dbo.vendor_quote_4_view
AS
SELECT DISTINCT 
                         dbo.kah_tab.idnanu_kah, dbo.vendor_quote_5_view.rfq_no_k42, dbo.vendor_quote_5_view.partno_k08, dbo.vendor_quote_5_view.p_cage_k08, dbo.vendor_quote_5_view.p_desc_k08, dbo.vendor_quote_5_view.fsc_k08, 
                         dbo.vendor_quote_5_view.niin_k08, dbo.vendor_quote_5_view.p_cage_k56, dbo.vendor_quote_5_view.partno_k56, dbo.vendor_quote_5_view.qrefno_k55, dbo.vendor_quote_5_view.qotdte_k55, 
                         dbo.vendor_quote_5_view.p_um_k56, dbo.vendor_quote_5_view.su_lbs_k56, dbo.vendor_quote_5_view.s_code_k39, dbo.vendor_quote_5_view.e_name_k12, dbo.vendor_quote_5_view.idnk55_k55, 
                         dbo.vendor_quote_5_view.idnk56_k56, dbo.vendor_quote_5_view.p_note_k56, dbo.vendor_quote_5_view.qfactr_k56, dbo.vendor_quote_5_view.q_type_k56, dbo.vendor_quote_5_view.q_note_k55, 
                         dbo.vendor_quote_5_view.uptime_k56, dbo.vendor_quote_5_view.upname_k56, dbo.vendor_quote_5_view.idnk39_k39, dbo.vendor_quote_5_view.idnk08_k08, dbo.vendor_quote_5_view.idnk12_k12, 
                         dbo.vendor_quote_5_view.idnk42_k42, dbo.vendor_quote_5_view.idnk43_k43, dbo.vendor_quote_5_view.addtme_k42, dbo.vendor_quote_5_view.rfquno_k42, dbo.vendor_quote_5_view.rqpsta_k43, 
                         dbo.vendor_quote_5_view.rqptme_k43, dbo.vendor_quote_5_view.rrqsta_k42, dbo.vendor_quote_5_view.itmcnt_k42, dbo.vendor_quote_5_view.uptime_k42, dbo.kah_tab.anutyp_kah, dbo.k57_tab.maxqty_k57, 
                         dbo.k57_tab.untcst_k57, dbo.k57_tab.dlyaro_k57, dbo.k57_tab.idnk57_k57, dbo.k57_tab.uptime_k57, dbo.k57_tab.minqty_k57, dbo.vendor_quote_5_view.uptime_k34, dbo.vendor_quote_5_view.idnk34_k34, 
                         dbo.kah_tab.uptime_kah, SUBSTRING(dbo.kah_tab.a_note_kah, 1, 1024) AS a_note_kah, dbo.vendor_quote_5_view.spncge_k40, dbo.vendor_quote_5_view.spnnum_k40, dbo.vendor_quote_5_view.idnk40_k40, 
                         dbo.vendor_quote_5_view.sol_no_k10, dbo.vendor_quote_5_view.closes_k10, dbo.k35_tab.up_k35, dbo.k35_tab.qty_k35
FROM            dbo.kah_tab RIGHT OUTER JOIN
                         dbo.vendor_quote_5_view INNER JOIN
                         dbo.k34_tab INNER JOIN
                         dbo.k35_tab ON dbo.k34_tab.idnk34_k34 = dbo.k35_tab.idnk34_k35 ON dbo.vendor_quote_5_view.idnk34_k34 = dbo.k34_tab.idnk34_k34 LEFT OUTER JOIN
                         dbo.k57_tab ON dbo.vendor_quote_5_view.idnk56_k56 = dbo.k57_tab.idnk56_k57 ON dbo.kah_tab.idnanu_kah = dbo.vendor_quote_5_view.idnk56_k56 AND dbo.kah_tab.anutbl_kah = 'K56'


